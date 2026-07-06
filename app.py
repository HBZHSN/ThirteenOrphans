from __future__ import annotations

import copy
import csv
import json
import re
import threading
import time
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from mahjong.constants import EAST, NORTH, SOUTH, WEST
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
from mahjong.hand_calculating.scores import ScoresCalculator
from mahjong.meld import Meld
from mahjong.tile import TilesConverter


BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, static_folder="static", static_url_path="/static")
calculator = HandCalculator()

TILE_RE = re.compile(r"^[0-9][mps]$|^[1-7]z$")
WINDS = {"east": EAST, "south": SOUTH, "west": WEST, "north": NORTH}
MELD_TYPES = {
    "chi": Meld.CHI,
    "pon": Meld.PON,
    "kan": Meld.KAN,
    "ankan": Meld.KAN,
    "shouminkan": Meld.SHOUMINKAN,
}
SEATS = ("east", "south", "west", "north")
WIND_LABELS = {"east": "东", "south": "南", "west": "西", "north": "北"}
ROOMS: dict[str, dict[str, Any]] = {}
ROOM_LOCK = threading.Lock()
STARTING_SCORE = 25000
RECORDS_DIR = BASE_DIR / "records"
WIN_RECORD_FIELDNAMES = (
    "index",
    "created_at",
    "room_name",
    "round_label",
    "winner_seat",
    "winner_name",
    "loser_seat",
    "loser_name",
    "outcome",
    "han",
    "fu",
    "score_deltas",
    "payments",
    "riichi_bonus",
    "yaku",
    "win_tile",
    "hand",
    "scores_before",
    "scores_after",
)


class InputError(ValueError):
    pass


@app.get("/")
def index():
    response = send_from_directory(BASE_DIR / "static", "index.html")
    response.headers["Content-Disposition"] = "inline; filename=index.html"
    return response


@app.get("/img/<path:filename>")
def tile_image(filename: str):
    return send_from_directory(BASE_DIR / "img", filename)


@app.post("/api/calculate")
def calculate():
    payload = request.get_json(silent=True) or {}
    try:
        result = estimate(payload)
    except InputError as exc:
        return jsonify(error_response(str(exc)))
    except Exception as exc:  # Keep library errors readable for fast in-game correction.
        return jsonify(error_response(f"计算失败：{exc}"))
    return jsonify(result)


@app.get("/api/rooms")
def list_rooms():
    with ROOM_LOCK:
        return jsonify({"ok": True, "rooms": [room_summary(room) for room in ROOMS.values()]})


@app.post("/api/rooms")
def create_room():
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    player_name = required_player_name(payload.get("playerName"))
    if not player_name:
        return jsonify(api_error("请先填写用户名")), 400
    room_name = str(payload.get("roomName") or "").strip()[:24] or "麻将房间"
    room_id = uuid.uuid4().hex[:8]
    now = time.time()
    room = {
        "id": room_id,
        "name": room_name,
        "status": "waiting",
        "created_at": now,
        "updated_at": now,
        "record_file": room_record_filename(room_name, now),
        "players": {},
        "seats": {seat: None for seat in SEATS},
        "scores": {seat: STARTING_SCORE for seat in SEATS},
        "hand_index": 0,
        "honba": 0,
        "riichi_sticks": 0,
        "current_riichi": [],
        "settlements": [],
        "version": 1,
    }
    with ROOM_LOCK:
        ROOMS[room_id] = room
        upsert_player(room, player_id, player_name)
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.get("/api/rooms/<room_id>")
def get_room(room_id: str):
    player_id = request.args.get("playerId")
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.post("/api/rooms/<room_id>/join")
def join_room(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    player_name = required_player_name(payload.get("playerName"))
    if not player_name:
        return jsonify(api_error("请先填写用户名")), 400
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        upsert_player(room, player_id, player_name)
        touch_room(room)
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.post("/api/rooms/<room_id>/seat")
def choose_room_seat(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    player_name = required_player_name(payload.get("playerName"))
    if not player_name:
        return jsonify(api_error("请先填写用户名")), 400
    seat = payload.get("seat")
    if seat not in SEATS:
        return jsonify(api_error("位置不合法")), 400
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        if room["status"] != "waiting":
            return jsonify(api_error("对局已经开始，不能换位置")), 400
        if room["seats"][seat] and room["seats"][seat] != player_id:
            return jsonify(api_error("这个位置已经有人了")), 409
        upsert_player(room, player_id, player_name)
        for existing_seat, existing_player_id in room["seats"].items():
            if existing_player_id == player_id:
                room["seats"][existing_seat] = None
        room["seats"][seat] = player_id
        touch_room(room)
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.post("/api/rooms/<room_id>/test-player")
def add_test_player(room_id: str):
    payload = request.get_json(silent=True) or {}
    requester_id = request.args.get("playerId") or payload.get("playerId")
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        if room["status"] != "waiting":
            return jsonify(api_error("对局已经开始，不能加入测试玩家")), 400
        empty_seat = next((seat for seat in SEATS if not room["seats"][seat]), None)
        if not empty_seat:
            return jsonify(api_error("房间已经坐满")), 400
        test_count = sum(1 for player in room["players"].values() if player.get("isTestPlayer"))
        player_id = f"test-{uuid.uuid4().hex[:8]}"
        player_name = normalize_player_name(payload.get("playerName"), default=f"测试玩家 {test_count + 1}")
        upsert_player(room, player_id, player_name, is_test_player=True)
        room["seats"][empty_seat] = player_id
        touch_room(room)
        return jsonify({"ok": True, "room": room_snapshot(room, requester_id), "seat": empty_seat})


@app.post("/api/rooms/<room_id>/start")
def start_room(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        if room["status"] == "playing":
            return jsonify({"ok": True, "room": room_snapshot(room, player_id)})
        if any(not room["seats"][seat] for seat in SEATS):
            return jsonify(api_error("4 个位置都有人后才能开始对局")), 400
        room["status"] = "playing"
        room["hand_index"] = 0
        room["honba"] = 0
        room["riichi_sticks"] = 0
        room["current_riichi"] = []
        touch_room(room)
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.post("/api/rooms/<room_id>/riichi")
def mark_riichi(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    seat = payload.get("seat")
    declared = bool(payload.get("declared", True))
    if seat not in SEATS:
        return jsonify(api_error("位置不合法")), 400
    with ROOM_LOCK:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify(api_error("房间不存在")), 404
        if room["status"] != "playing":
            return jsonify(api_error("对局开始后才能记录立直")), 400
        if not room["seats"][seat]:
            return jsonify(api_error("这个位置还没有玩家")), 400
        current_riichi = set(room["current_riichi"])
        if declared:
            if seat not in current_riichi:
                if room["scores"][seat] < 1000:
                    return jsonify(api_error("点数不足，不能立直")), 400
                room["scores"][seat] -= 1000
                room["riichi_sticks"] += 1
                current_riichi.add(seat)
        else:
            if seat in current_riichi:
                room["scores"][seat] += 1000
                room["riichi_sticks"] = max(0, room["riichi_sticks"] - 1)
                current_riichi.remove(seat)
        room["current_riichi"] = sorted(current_riichi, key=SEATS.index)
        touch_room(room)
        return jsonify({"ok": True, "room": room_snapshot(room, player_id)})


@app.post("/api/rooms/<room_id>/settle-preview")
def preview_room_settlement(room_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        with ROOM_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                return jsonify(api_error("房间不存在")), 404
            settlement = build_room_settlement(room, payload, apply=False)
            return jsonify({"ok": True, **settlement})
    except InputError as exc:
        return jsonify(api_error(str(exc))), 400
    except Exception as exc:
        return jsonify(api_error(f"结算失败：{exc}")), 400


@app.post("/api/rooms/<room_id>/settle")
def settle_room(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    try:
        with ROOM_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                return jsonify(api_error("房间不存在")), 404
            expected_version = payload.get("version")
            if expected_version is not None and int(expected_version) != int(room["version"]):
                return jsonify(api_error("房间状态已变化，请重新预览结算")), 409
            settlement = build_room_settlement(room, payload, apply=True)
            return jsonify({"ok": True, **settlement, "room": room_snapshot(room, player_id)})
    except InputError as exc:
        return jsonify(api_error(str(exc))), 400
    except Exception as exc:
        return jsonify(api_error(f"结算失败：{exc}")), 400


@app.post("/api/rooms/<room_id>/settle-direct")
def settle_room_direct(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = normalize_player_id(payload.get("playerId"))
    try:
        with ROOM_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                return jsonify(api_error("房间不存在")), 404
            expected_version = payload.get("version")
            if expected_version is not None and int(expected_version) != int(room["version"]):
                return jsonify(api_error("房间状态已变化，请重新录入点数")), 409
            settlement = build_direct_room_settlement(room, payload)
            return jsonify({"ok": True, **settlement, "room": room_snapshot(room, player_id)})
    except InputError as exc:
        return jsonify(api_error(str(exc))), 400
    except Exception as exc:
        return jsonify(api_error(f"直接录点失败：{exc}")), 400


@app.post("/api/rooms/<room_id>/settle/undo")
def undo_room_settlement(room_id: str):
    payload = request.get_json(silent=True) or {}
    player_id = str(payload.get("playerId") or "").strip()
    try:
        with ROOM_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                return jsonify(api_error("房间不存在")), 404
            if player_id not in set(room["seats"].values()):
                return jsonify(api_error("只有当前房间玩家可以撤销胡牌")), 403
            if not room["settlements"]:
                return jsonify(api_error("暂无可撤销的胡牌记录")), 400
            latest = room["settlements"][-1]
            before_state = latest.get("beforeState")
            if not before_state:
                return jsonify(api_error("这条胡牌记录缺少可恢复状态")), 400
            rewrite_room_records_csv(room, room["settlements"][:-1])
            room["settlements"].pop()
            restore_room_state(room, before_state)
            touch_room(room)
            return jsonify(
                {
                    "ok": True,
                    "undoneRecord": win_record_summary(room, latest, len(room["settlements"]) + 1),
                    "room": room_snapshot(room, player_id),
                }
            )
    except InputError as exc:
        return jsonify(api_error(str(exc))), 400
    except Exception as exc:
        return jsonify(api_error(f"撤销失败：{exc}")), 400


def api_error(message: str) -> dict[str, Any]:
    return {"ok": False, "error": message}


def normalize_player_id(value: Any) -> str:
    player_id = str(value or "").strip()
    if player_id:
        return player_id[:64]
    return uuid.uuid4().hex


def required_player_name(value: Any) -> str | None:
    player_name = str(value or "").strip()
    return player_name[:24] if player_name else None


def normalize_player_name(value: Any, default: str = "玩家") -> str:
    player_name = str(value or "").strip()
    return player_name[:24] or default


def upsert_player(room: dict[str, Any], player_id: str, player_name: str, is_test_player: bool = False) -> None:
    room["players"][player_id] = {
        "id": player_id,
        "name": player_name,
        "isTestPlayer": is_test_player,
    }


def touch_room(room: dict[str, Any]) -> None:
    room["updated_at"] = time.time()
    room["version"] += 1


def room_summary(room: dict[str, Any]) -> dict[str, Any]:
    occupied = sum(1 for seat in SEATS if room["seats"][seat])
    return {
        "id": room["id"],
        "name": room["name"],
        "status": room["status"],
        "occupied": occupied,
        "capacity": len(SEATS),
        "roundLabel": round_label(room),
        "updatedAt": room["updated_at"],
    }


def room_snapshot(room: dict[str, Any], player_id: Any = None) -> dict[str, Any]:
    seats = {}
    for seat in SEATS:
        current_player_id = room["seats"][seat]
        player = room["players"].get(current_player_id) if current_player_id else None
        seats[seat] = {
            "seat": seat,
            "seatLabel": WIND_LABELS[seat],
            "player": player,
            "score": room["scores"][seat],
            "currentWind": current_wind_for_seat(room, seat),
            "currentWindLabel": WIND_LABELS[current_wind_for_seat(room, seat)],
            "isDealer": seat == dealer_seat(room),
            "riichiDeclared": seat in room["current_riichi"],
        }
    current_player_id = str(player_id or "")
    my_seat = next((seat for seat in SEATS if room["seats"][seat] == current_player_id), None)
    return {
        "id": room["id"],
        "name": room["name"],
        "status": room["status"],
        "seats": seats,
        "players": list(room["players"].values()),
        "mySeat": my_seat,
        "canStart": room["status"] == "waiting" and all(room["seats"][seat] for seat in SEATS),
        "round": {
            "roundWind": round_wind(room),
            "roundWindLabel": WIND_LABELS[round_wind(room)],
            "handNumber": hand_number(room),
            "honba": room["honba"],
            "riichiSticks": room["riichi_sticks"],
            "dealerSeat": dealer_seat(room),
            "dealerSeatLabel": WIND_LABELS[dealer_seat(room)],
            "label": round_label(room),
        },
        "winRecords": [
            win_record_summary(room, record, index)
            for index, record in enumerate(room.get("settlements", []), start=1)
        ],
        "recordFile": Path(room_record_path(room)).name,
        "version": room["version"],
    }


def round_wind(room: dict[str, Any]) -> str:
    return SEATS[(room["hand_index"] // 4) % len(SEATS)]


def hand_number(room: dict[str, Any]) -> int:
    return room["hand_index"] % len(SEATS) + 1


def dealer_seat(room: dict[str, Any]) -> str:
    return SEATS[room["hand_index"] % len(SEATS)]


def current_wind_for_seat(room: dict[str, Any], seat: str) -> str:
    dealer_index = SEATS.index(dealer_seat(room))
    seat_index = SEATS.index(seat)
    return SEATS[(seat_index - dealer_index) % len(SEATS)]


def round_label(room: dict[str, Any]) -> str:
    return f"{WIND_LABELS[round_wind(room)]}{hand_number(room)}局 {room['honba']}本场"


def build_room_settlement(room: dict[str, Any], payload: dict[str, Any], apply: bool) -> dict[str, Any]:
    if room["status"] != "playing":
        raise InputError("对局开始后才能结算")
    requester_id = str(payload.get("playerId") or "").strip()
    winner_seat = payload.get("winnerSeat")
    loser_seat = payload.get("loserSeat")
    if winner_seat not in SEATS:
        raise InputError("赢家位置不合法")
    if not room["seats"][winner_seat]:
        raise InputError("赢家位置还没有玩家")
    if room["seats"][winner_seat] != requester_id:
        raise InputError("只能录入自己的和牌")

    hand = dict(payload.get("hand") or {})
    round_info = dict(hand.get("round") or {})
    is_tsumo = bool(round_info.get("isTsumo"))
    if is_tsumo:
        loser_seat = None
    elif loser_seat not in SEATS:
        raise InputError("荣和时必须选择放铳者")
    elif loser_seat == winner_seat:
        raise InputError("放铳者不能是赢家")
    elif not room["seats"][loser_seat]:
        raise InputError("放铳位置还没有玩家")

    round_info.update(
        {
            "isDealer": winner_seat == dealer_seat(room),
            "playerWind": current_wind_for_seat(room, winner_seat),
            "roundWind": round_wind(room),
            "honba": room["honba"],
        }
    )
    hand["round"] = round_info
    result = estimate(hand)
    if not result.get("ok"):
        raise InputError(str(result.get("error") or "无法计算"))

    settlement = score_deltas(room, winner_seat, loser_seat, hand, result)
    if apply:
        apply_room_settlement_result(
            room,
            requester_id,
            winner_seat,
            loser_seat,
            hand,
            result,
            settlement,
        )

    return {
        "result": result,
        "settlement": settlement,
        "roomVersion": room["version"],
    }


def build_direct_room_settlement(room: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    if room["status"] != "playing":
        raise InputError("对局开始后才能结算")
    requester_id = str(payload.get("playerId") or "").strip()
    winner_seat = payload.get("winnerSeat")
    loser_seat = payload.get("loserSeat")
    if winner_seat not in SEATS:
        raise InputError("赢家位置不合法")
    if not room["seats"][winner_seat]:
        raise InputError("赢家位置还没有玩家")
    if room["seats"][winner_seat] != requester_id:
        raise InputError("只能录入自己的和牌")

    direct_score = normalize_direct_score(payload.get("directScore"), winner_seat, room)
    if direct_score["isTsumo"]:
        loser_seat = None
    elif loser_seat not in SEATS:
        raise InputError("荣和时必须选择放铳者")
    elif loser_seat == winner_seat:
        raise InputError("放铳者不能是赢家")
    elif not room["seats"][loser_seat]:
        raise InputError("放铳位置还没有玩家")

    riichi_seats = normalize_riichi_seats(payload.get("riichiSeats") or [], room)
    before_state = room_state_for_undo(room)
    try:
        apply_riichi_selection(room, riichi_seats)

        hand = {
            "directScore": copy.deepcopy(direct_score),
            "round": {
                "isTsumo": direct_score["isTsumo"],
                "isDealer": winner_seat == dealer_seat(room),
                "playerWind": current_wind_for_seat(room, winner_seat),
                "roundWind": round_wind(room),
                "honba": room["honba"],
            },
        }
        result = {
            "ok": True,
            "han": None,
            "fu": None,
            "cost": direct_score_cost(direct_score),
            "yaku": ["直接录入"],
            "fuDetails": [],
            "directScore": copy.deepcopy(direct_score),
            "error": None,
        }
        settlement = direct_score_deltas(room, winner_seat, loser_seat, direct_score)
        apply_room_settlement_result(
            room,
            requester_id,
            winner_seat,
            loser_seat,
            hand,
            result,
            settlement,
            before_state=before_state,
        )
    except Exception:
        restore_room_state(room, before_state)
        raise
    return {
        "result": result,
        "settlement": settlement,
        "roomVersion": room["version"],
    }


def apply_room_settlement_result(
    room: dict[str, Any],
    requester_id: str,
    winner_seat: str,
    loser_seat: str | None,
    hand: dict[str, Any],
    result: dict[str, Any],
    settlement: dict[str, Any],
    before_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    before_state = before_state or room_state_for_undo(room)
    scores_before = copy.deepcopy(room["scores"])
    scores_after = {
        seat: int(scores_before[seat]) + int(settlement["deltas"].get(seat, 0))
        for seat in SEATS
    }
    record = build_win_record(
        room,
        requester_id,
        winner_seat,
        loser_seat,
        hand,
        result,
        settlement,
        before_state,
        scores_before,
        scores_after,
    )
    append_room_record_csv(room, record, len(room["settlements"]) + 1)
    room["scores"] = scores_after
    room["settlements"].append(record)
    if winner_seat == dealer_seat(room):
        room["honba"] += 1
    else:
        room["hand_index"] += 1
        room["honba"] = 0
    room["riichi_sticks"] = 0
    room["current_riichi"] = []
    touch_room(room)
    return record


def room_state_for_undo(room: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(
        {
            "status": room["status"],
            "scores": room["scores"],
            "hand_index": room["hand_index"],
            "honba": room["honba"],
            "riichi_sticks": room["riichi_sticks"],
            "current_riichi": room["current_riichi"],
        }
    )


def restore_room_state(room: dict[str, Any], before_state: dict[str, Any]) -> None:
    if not isinstance(before_state, dict):
        raise InputError("胡牌记录恢复状态不合法")
    scores = before_state.get("scores")
    if not isinstance(scores, dict) or any(seat not in scores for seat in SEATS):
        raise InputError("胡牌记录点数状态不完整")
    room["status"] = before_state.get("status") or room["status"]
    room["scores"] = {seat: int(scores[seat]) for seat in SEATS}
    room["hand_index"] = int(before_state.get("hand_index") or 0)
    room["honba"] = int(before_state.get("honba") or 0)
    room["riichi_sticks"] = int(before_state.get("riichi_sticks") or 0)
    current_riichi = before_state.get("current_riichi") or []
    room["current_riichi"] = [seat for seat in current_riichi if seat in SEATS]


def build_win_record(
    room: dict[str, Any],
    requester_id: str,
    winner_seat: str,
    loser_seat: str | None,
    hand: dict[str, Any],
    result: dict[str, Any],
    settlement: dict[str, Any],
    before_state: dict[str, Any],
    scores_before: dict[str, int],
    scores_after: dict[str, int],
) -> dict[str, Any]:
    return {
        "id": uuid.uuid4().hex[:10],
        "createdAt": time.time(),
        "recordedBy": requester_id,
        "winnerSeat": winner_seat,
        "winnerName": player_name_for_seat(room, winner_seat),
        "loserSeat": loser_seat,
        "loserName": player_name_for_seat(room, loser_seat) if loser_seat else "",
        "isTsumo": bool(settlement.get("isTsumo")),
        "roundLabel": round_label(room),
        "round": {
            "roundWind": round_wind(room),
            "handNumber": hand_number(room),
            "honba": room["honba"],
            "dealerSeat": dealer_seat(room),
            "riichiSticks": room["riichi_sticks"],
        },
        "deltas": copy.deepcopy(settlement["deltas"]),
        "payments": copy.deepcopy(settlement["payments"]),
        "riichiBonus": int(settlement.get("riichiBonus") or 0),
        "result": copy.deepcopy(result),
        "hand": copy.deepcopy(hand),
        "scoresBefore": copy.deepcopy(scores_before),
        "scoresAfter": copy.deepcopy(scores_after),
        "beforeState": before_state,
    }


def win_record_summary(room: dict[str, Any], record: dict[str, Any], index: int) -> dict[str, Any]:
    winner_seat = record.get("winnerSeat")
    loser_seat = record.get("loserSeat")
    result = record.get("result") or {}
    return {
        "id": record.get("id") or str(index),
        "index": index,
        "createdAt": record.get("createdAt"),
        "roundLabel": record.get("roundLabel") or "",
        "winnerSeat": winner_seat,
        "winnerName": record.get("winnerName") or player_name_for_seat(room, winner_seat),
        "loserSeat": loser_seat,
        "loserName": record.get("loserName") or (player_name_for_seat(room, loser_seat) if loser_seat else ""),
        "isTsumo": bool(record.get("isTsumo")),
        "deltas": record.get("deltas") or {seat: 0 for seat in SEATS},
        "payments": record.get("payments") or [],
        "riichiBonus": int(record.get("riichiBonus") or 0),
        "han": result.get("han"),
        "fu": result.get("fu"),
        "yaku": result.get("yaku") or [],
        "directScore": result.get("directScore") or record.get("directScore") or {},
        "scoresAfter": record.get("scoresAfter") or {},
    }


def room_record_filename(room_name: str, created_at: float) -> str:
    safe_name = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", room_name).strip().strip(".")
    safe_name = re.sub(r"\s+", " ", safe_name)[:40] or "麻将房间"
    created_label = time.strftime("%y%m%d%H%M%S", time.localtime(created_at))
    return f"{safe_name}-{created_label}.csv"


def room_record_path(room: dict[str, Any]) -> Path:
    filename = room.get("record_file")
    if not filename:
        filename = room_record_filename(room.get("name") or "麻将房间", float(room.get("created_at") or time.time()))
        room["record_file"] = filename
    return RECORDS_DIR / Path(filename).name


def append_room_record_csv(room: dict[str, Any], record: dict[str, Any], index: int) -> None:
    path = room_record_path(room)
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    needs_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=WIN_RECORD_FIELDNAMES)
        if needs_header:
            writer.writeheader()
        writer.writerow(win_record_csv_row(room, record, index))


def rewrite_room_records_csv(room: dict[str, Any], records: list[dict[str, Any]]) -> None:
    path = room_record_path(room)
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=WIN_RECORD_FIELDNAMES)
        writer.writeheader()
        for index, record in enumerate(records, start=1):
            writer.writerow(win_record_csv_row(room, record, index))


def win_record_csv_row(room: dict[str, Any], record: dict[str, Any], index: int) -> dict[str, Any]:
    result = record.get("result") or {}
    hand = record.get("hand") or {}
    return {
        "index": index,
        "created_at": format_record_time(record.get("createdAt")),
        "room_name": room.get("name") or "",
        "round_label": record.get("roundLabel") or "",
        "winner_seat": WIND_LABELS.get(record.get("winnerSeat"), record.get("winnerSeat") or ""),
        "winner_name": record.get("winnerName") or "",
        "loser_seat": WIND_LABELS.get(record.get("loserSeat"), record.get("loserSeat") or ""),
        "loser_name": record.get("loserName") or "",
        "outcome": "自摸" if record.get("isTsumo") else "荣和",
        "han": result.get("han"),
        "fu": result.get("fu"),
        "score_deltas": json_text(record.get("deltas") or {}),
        "payments": json_text(record.get("payments") or []),
        "riichi_bonus": int(record.get("riichiBonus") or 0),
        "yaku": "; ".join(str(item) for item in result.get("yaku") or []),
        "win_tile": hand.get("winTile") or "",
        "hand": json_text(hand),
        "scores_before": json_text(record.get("scoresBefore") or {}),
        "scores_after": json_text(record.get("scoresAfter") or {}),
    }


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def format_record_time(value: Any) -> str:
    try:
        timestamp = float(value)
    except (TypeError, ValueError):
        timestamp = time.time()
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))


def normalize_direct_score(value: Any, winner_seat: str, room: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise InputError("直接录点数据格式不合法")
    is_tsumo = bool(value.get("isTsumo"))
    main = normalize_payment_amount(value.get("main"), "点数")
    additional = 0
    if is_tsumo:
        if winner_seat == dealer_seat(room):
            additional = main
        else:
            additional = normalize_payment_amount(value.get("additional"), "子家支付点数")
    return {
        "isTsumo": is_tsumo,
        "main": main,
        "additional": additional,
    }


def normalize_payment_amount(value: Any, label: str) -> int:
    try:
        amount = int(value)
    except (TypeError, ValueError):
        raise InputError(f"{label}必须是数字")
    if amount <= 0:
        raise InputError(f"{label}必须大于 0")
    if amount % 100 != 0:
        raise InputError(f"{label}必须是 100 的倍数")
    if amount > 500000:
        raise InputError(f"{label}过大，请检查输入")
    return amount


def normalize_riichi_seats(value: Any, room: dict[str, Any]) -> list[str]:
    if not isinstance(value, list):
        raise InputError("立直位置数据格式不合法")
    seats = []
    for seat in value:
        if seat not in SEATS:
            raise InputError("立直位置不合法")
        if not room["seats"][seat]:
            raise InputError("未入座的位置不能立直")
        if seat not in seats:
            seats.append(seat)
    return sorted(seats, key=SEATS.index)


def apply_riichi_selection(room: dict[str, Any], selected_seats: list[str]) -> None:
    selected = set(selected_seats)
    current = set(room["current_riichi"])
    for seat in sorted(selected - current, key=SEATS.index):
        if room["scores"][seat] < 1000:
            raise InputError(f"{WIND_LABELS[seat]}位点数不足，不能立直")
    for seat in sorted(current - selected, key=SEATS.index):
        room["scores"][seat] += 1000
        room["riichi_sticks"] = max(0, room["riichi_sticks"] - 1)
    for seat in sorted(selected - current, key=SEATS.index):
        room["scores"][seat] -= 1000
        room["riichi_sticks"] += 1
    room["current_riichi"] = sorted(selected, key=SEATS.index)


def direct_score_cost(direct_score: dict[str, Any]) -> dict[str, int]:
    return {
        "main": int(direct_score.get("main") or 0),
        "additional": int(direct_score.get("additional") or 0),
        "main_bonus": 0,
        "additional_bonus": 0,
    }


def direct_score_deltas(
    room: dict[str, Any],
    winner_seat: str,
    loser_seat: str | None,
    direct_score: dict[str, Any],
) -> dict[str, Any]:
    main_payment = int(direct_score.get("main") or 0)
    additional_payment = int(direct_score.get("additional") or 0)
    is_tsumo = bool(direct_score.get("isTsumo"))
    deltas = {seat: 0 for seat in SEATS}
    payments = []

    if is_tsumo:
        for seat in SEATS:
            if seat == winner_seat:
                continue
            amount = main_payment if winner_seat == dealer_seat(room) or seat == dealer_seat(room) else additional_payment
            add_payment(payments, deltas, seat, winner_seat, amount, "自摸")
    else:
        if not loser_seat:
            raise InputError("荣和时必须选择放铳者")
        add_payment(payments, deltas, loser_seat, winner_seat, main_payment, "荣和")

    riichi_bonus = int(room["riichi_sticks"]) * 1000
    if riichi_bonus:
        deltas[winner_seat] += riichi_bonus
        payments.append({"from": "riichi", "to": winner_seat, "amount": riichi_bonus, "reason": "供托"})

    return {
        "winnerSeat": winner_seat,
        "loserSeat": loser_seat,
        "isTsumo": is_tsumo,
        "deltas": deltas,
        "payments": payments,
        "riichiBonus": riichi_bonus,
        "roundLabel": round_label(room),
        "winnerName": player_name_for_seat(room, winner_seat),
        "directScore": copy.deepcopy(direct_score),
    }


def score_deltas(
    room: dict[str, Any],
    winner_seat: str,
    loser_seat: str | None,
    hand: dict[str, Any],
    result: dict[str, Any],
) -> dict[str, Any]:
    cost = result.get("cost") or {}
    main_payment = int(cost.get("main") or 0) + int(cost.get("main_bonus") or 0)
    additional_payment = int(cost.get("additional") or 0) + int(cost.get("additional_bonus") or 0)
    is_tsumo = bool((hand.get("round") or {}).get("isTsumo"))
    deltas = {seat: 0 for seat in SEATS}
    payments = []

    if is_tsumo:
        for seat in SEATS:
            if seat == winner_seat:
                continue
            amount = main_payment if winner_seat == dealer_seat(room) or seat == dealer_seat(room) else additional_payment
            add_payment(payments, deltas, seat, winner_seat, amount, "自摸")
    else:
        if not loser_seat:
            raise InputError("荣和时必须选择放铳者")
        add_payment(payments, deltas, loser_seat, winner_seat, main_payment, "荣和")

    riichi_bonus = int(room["riichi_sticks"]) * 1000
    if riichi_bonus:
        deltas[winner_seat] += riichi_bonus
        payments.append({"from": "riichi", "to": winner_seat, "amount": riichi_bonus, "reason": "供托"})

    return {
        "winnerSeat": winner_seat,
        "loserSeat": loser_seat,
        "isTsumo": is_tsumo,
        "deltas": deltas,
        "payments": payments,
        "riichiBonus": riichi_bonus,
        "roundLabel": round_label(room),
        "winnerName": player_name_for_seat(room, winner_seat),
    }


def add_payment(
    payments: list[dict[str, Any]],
    deltas: dict[str, int],
    from_seat: str,
    to_seat: str,
    amount: int,
    reason: str,
) -> None:
    deltas[from_seat] -= amount
    deltas[to_seat] += amount
    payments.append({"from": from_seat, "to": to_seat, "amount": amount, "reason": reason})


def player_name_for_seat(room: dict[str, Any], seat: str) -> str:
    player_id = room["seats"].get(seat)
    player = room["players"].get(player_id) if player_id else None
    return player["name"] if player else WIND_LABELS[seat]


def estimate(data: dict[str, Any]) -> dict[str, Any]:
    closed_tiles = normalize_tiles(data.get("closedTiles", []), "手牌")
    win_tile = data.get("winTile")
    if not is_tile(win_tile):
        raise InputError("必须选择和牌牌")
    if win_tile not in closed_tiles:
        raise InputError("和牌牌必须包含在当前手牌中")

    melds_data = data.get("melds", [])
    if not isinstance(melds_data, list):
        raise InputError("副露数据格式不合法")
    if len(melds_data) > 4:
        raise InputError("副露数量不能超过 4 组")

    expected_closed_count = 14 - 3 * len(melds_data)
    if len(closed_tiles) != expected_closed_count:
        raise InputError(
            f"手牌数量不合法：当前有 {len(closed_tiles)} 张，"
            f"{len(melds_data)} 组副露时应为 {expected_closed_count} 张"
        )

    hand_counter = Counter(base_tile(tile) for tile in closed_tiles)
    melds = []
    meld_tiles = []
    has_open_meld = False
    for item in melds_data:
        meld = build_meld(item)
        melds.append(meld)
        meld_tiles.extend(item["tiles"])
        hand_counter.update(base_tile(tile) for tile in item["tiles"])
        if meld.opened:
            has_open_meld = True

    overused = [tile for tile, count in hand_counter.items() if count > 4]
    if overused:
        raise InputError(f"同一种牌最多 4 张：{', '.join(overused)} 超出限制")

    flags = data.get("flags", {}) or {}
    round_info = data.get("round", {}) or {}
    if has_open_meld and any(flags.get(name) for name in ("isRiichi", "isDoubleRiichi", "isIppatsu")):
        raise InputError("有开放副露时不能选择立直、双立直或一发")
    if flags.get("isRiichi") and flags.get("isDoubleRiichi"):
        raise InputError("立直和双立直不能同时选择")
    if flags.get("isHaitei") and flags.get("isHoutei"):
        raise InputError("海底和河底不能同时选择")

    # mahjong expects the full hand in tiles, with opened sets also supplied as Melds.
    tiles_136 = tiles_to_136(closed_tiles + meld_tiles)
    win_tile_136 = select_win_tile(tiles_136, win_tile)
    manual_dora_count = int(data.get("manualDoraCount") or 0)
    manual_ura_dora_count = int(data.get("manualUraDoraCount") or 0)
    if manual_dora_count < 0 or manual_ura_dora_count < 0:
        raise InputError("宝牌数量不能为负数")
    if manual_dora_count > 20 or manual_ura_dora_count > 20:
        raise InputError("宝牌数量过大，请检查输入")

    dora_indicators = tiles_to_136(normalize_tiles(data.get("doraIndicators", []), "宝牌指示牌"))
    ura_dora_indicators = []
    if flags.get("isRiichi") or flags.get("isDoubleRiichi"):
        ura_dora_indicators = tiles_to_136(normalize_tiles(data.get("uraDoraIndicators", []), "里宝牌指示牌"))
    else:
        manual_ura_dora_count = 0

    options = data.get("options", {}) or {}
    player_wind = EAST if round_info.get("isDealer") else WINDS.get(round_info.get("playerWind"), SOUTH)
    if not round_info.get("isDealer") and player_wind == EAST:
        player_wind = SOUTH
    config = HandConfig(
        is_tsumo=bool(round_info.get("isTsumo")),
        is_riichi=bool(flags.get("isRiichi")),
        is_daburu_riichi=bool(flags.get("isDoubleRiichi")),
        is_ippatsu=bool(flags.get("isIppatsu")),
        is_haitei=bool(flags.get("isHaitei")),
        is_houtei=bool(flags.get("isHoutei")),
        is_rinshan=bool(flags.get("isRinshan")),
        is_chankan=bool(flags.get("isChankan")),
        is_tenhou=bool(flags.get("isTenhou")),
        is_chiihou=bool(flags.get("isChiihou")),
        is_renhou=bool(flags.get("isRenhou")),
        player_wind=player_wind,
        round_wind=WINDS.get(round_info.get("roundWind"), EAST),
        tsumi_number=int(round_info.get("honba") or 0),
        options=OptionalRules(
            has_open_tanyao=bool(options.get("hasOpenTanyao", True)),
            has_aka_dora=bool(options.get("hasAkaDora", True)),
        ),
    )

    result = calculator.estimate_hand_value(
        tiles_136,
        win_tile_136,
        melds=melds,
        dora_indicators=dora_indicators,
        ura_dora_indicators=ura_dora_indicators,
        config=config,
    )
    if getattr(result, "error", None):
        return error_response(str(result.error))

    han = result.han
    cost = result.cost
    yaku = [str(yaku) for yaku in result.yaku]
    manual_dora_total = manual_dora_count + manual_ura_dora_count
    has_yakuman = any(getattr(yaku_item, "is_yakuman", False) for yaku_item in result.yaku)
    if manual_dora_total and not dora_indicators and not ura_dora_indicators and not has_yakuman:
        han += manual_dora_total
        cost = ScoresCalculator.calculate_scores(han, result.fu, config)
        yaku.append(f"宝牌/里宝牌 {manual_dora_total}")

    return {
        "ok": True,
        "han": han,
        "fu": result.fu,
        "cost": cost,
        "yaku": yaku,
        "fuDetails": result.fu_details or [],
        "error": None,
    }


def error_response(message: str) -> dict[str, Any]:
    return {"ok": False, "han": None, "fu": None, "cost": None, "yaku": [], "fuDetails": [], "error": message}


def build_meld(item: Any) -> Meld:
    if not isinstance(item, dict):
        raise InputError("副露数据格式不合法")
    meld_type = item.get("type")
    tiles = normalize_tiles(item.get("tiles", []), "副露")
    opened = bool(item.get("opened", True))

    if meld_type == "chi":
        validate_chi(tiles)
    elif meld_type == "pon":
        validate_same(tiles, 3, "碰")
    elif meld_type in ("kan", "ankan", "shouminkan"):
        validate_same(tiles, 4, "杠")
    else:
        raise InputError("未知副露类型")

    return Meld(
        meld_type=MELD_TYPES[meld_type],
        tiles=tiles_to_136(tiles),
        opened=opened,
    )


def normalize_tiles(value: Any, label: str) -> list[str]:
    if not isinstance(value, list):
        raise InputError(f"{label}数据格式不合法")
    tiles = []
    for tile in value:
        if not is_tile(tile):
            raise InputError(f"{label}包含非法牌：{tile}")
        tiles.append(tile)
    return tiles


def is_tile(value: Any) -> bool:
    return isinstance(value, str) and bool(TILE_RE.match(value))


def base_tile(tile: str) -> str:
    return f"5{tile[1]}" if tile[0] == "0" else tile


def validate_same(tiles: list[str], count: int, label: str) -> None:
    if len(tiles) != count or len({base_tile(tile) for tile in tiles}) != 1:
        raise InputError(f"{label}必须由 {count} 张相同牌组成")


def validate_chi(tiles: list[str]) -> None:
    if len(tiles) != 3:
        raise InputError("吃必须由 3 张牌组成")
    suits = {tile[1] for tile in tiles}
    if len(suits) != 1 or next(iter(suits)) == "z":
        raise InputError("吃只能由同花色连续数牌组成")
    numbers = sorted(5 if tile[0] == "0" else int(tile[0]) for tile in tiles)
    if numbers[1] != numbers[0] + 1 or numbers[2] != numbers[1] + 1:
        raise InputError("吃必须是连续三张数牌")


def tiles_to_136(tiles: list[str]) -> list[int]:
    groups = {"m": "", "p": "", "s": "", "z": ""}
    for tile in tiles:
        groups[tile[1]] += tile[0]
    return TilesConverter.string_to_136_array(
        man=groups["m"],
        pin=groups["p"],
        sou=groups["s"],
        honors=groups["z"],
        has_aka_dora=True,
    )


def select_win_tile(tiles_136: list[int], win_tile: str) -> int:
    candidates = tiles_to_136([win_tile])
    for candidate in candidates:
        if candidate in tiles_136:
            return candidate
    base = base_tile(win_tile)
    base_candidates = tiles_to_136([base])
    base_index = base_candidates[0] // 4
    for tile in tiles_136:
        if tile // 4 == base_index:
            return tile
    raise InputError("和牌牌必须包含在当前手牌中")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
