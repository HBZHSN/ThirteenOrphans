from __future__ import annotations

import re
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


class InputError(ValueError):
    pass


@app.get("/")
def index():
    return send_from_directory(BASE_DIR / "static", "index.html")


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
        kyoutaku_number=int(round_info.get("riichiSticks") or 0),
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
        if manual_dora_count:
            yaku.append(f"宝牌 {manual_dora_count}")
        if manual_ura_dora_count:
            yaku.append(f"里宝牌 {manual_ura_dora_count}")

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
    app.run(host="0.0.0.0", port=5000, debug=True)
