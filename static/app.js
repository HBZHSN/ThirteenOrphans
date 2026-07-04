const tileGroups = {
  "万": ["1m", "2m", "3m", "4m", "0m", "5m", "6m", "7m", "8m", "9m"],
  "筒": ["1p", "2p", "3p", "4p", "0p", "5p", "6p", "7p", "8p", "9p"],
  "索": ["1s", "2s", "3s", "4s", "0s", "5s", "6s", "7s", "8s", "9s"],
  "字": ["1z", "2z", "3z", "4z", "5z", "6z", "7z"],
};

const flagLabels = {
  isRiichi: "立直",
  isDoubleRiichi: "双立直",
  isIppatsu: "一发",
  isHaitei: "海底",
  isHoutei: "河底",
  isRinshan: "岭上",
  isChankan: "抢杠",
  isTenhou: "天和",
  isChiihou: "地和",
  isRenhou: "人和",
};

const meldLabels = {
  chi: "吃",
  pon: "碰",
  kan: "明杠",
  ankan: "暗杠",
  shouminkan: "加杠",
};

const suitLabels = {
  m: "万",
  p: "筒",
  s: "索",
  z: "字",
};

const honorLabels = {
  "1z": "东",
  "2z": "南",
  "3z": "西",
  "4z": "北",
  "5z": "白",
  "6z": "发",
  "7z": "中",
};

const yakuTranslations = {
  "Menzen Tsumo": "门前清自摸和",
  "Riichi": "立直",
  "Daburu Riichi": "双立直",
  "Ippatsu": "一发",
  "Chankan": "抢杠",
  "Rinshan Kaihou": "岭上开花",
  "Haitei Raoyue": "海底摸月",
  "Houtei Raoyui": "河底捞鱼",
  "Tanyao": "断幺九",
  "Pinfu": "平和",
  "Iipeiko": "一杯口",
  "Yakuhai (haku)": "役牌 白",
  "Yakuhai (hatsu)": "役牌 发",
  "Yakuhai (chun)": "役牌 中",
  "Chantai": "混全带幺九",
  "Sanshoku Doujun": "三色同顺",
  "Ittsu": "一气通贯",
  "Toitoi": "对对和",
  "San Ankou": "三暗刻",
  "Sanshoku Doukou": "三色同刻",
  "San Kantsu": "三杠子",
  "Shosangen": "小三元",
  "Honroto": "混老头",
  "Chiitoitsu": "七对子",
  "Junchan": "纯全带幺九",
  "Ryanpeiko": "二杯口",
  "Honitsu": "混一色",
  "Chinitsu": "清一色",
  "Renhou": "人和",
  "Tenhou": "天和",
  "Chiihou": "地和",
  "Kokushi Musou": "国士无双",
  "Kokushi Musou 13-side wait": "国士无双十三面",
  "Suu Ankou": "四暗刻",
  "Suu Ankou Tanki": "四暗刻单骑",
  "Daisangen": "大三元",
  "Shousuushi": "小四喜",
  "Daisuushi": "大四喜",
  "Tsuuiisou": "字一色",
  "Tsuu Iisou": "字一色",
  "Ryuuiisou": "绿一色",
  "Chinroto": "清老头",
  "Chuuren Poutou": "九莲宝灯",
  "Chuuren Poutou 9-side wait": "纯正九莲宝灯",
  "Suu Kantsu": "四杠子",
  "Dora": "宝牌",
  "Aka Dora": "红宝牌",
  "Ura Dora": "里宝牌",
};

const fuReasonTranslations = {
  base: "底符",
  penchan: "边张听牌",
  kanchan: "嵌张听牌",
  valued_pair: "役牌雀头",
  double_valued_pair: "连风牌雀头",
  pair_wait: "单骑听牌",
  tsumo: "自摸",
  hand_without_fu: "副露平和形",
  closed_pon: "门清中张刻子",
  open_pon: "明刻中张",
  closed_terminal_pon: "门清幺九刻子",
  open_terminal_pon: "明刻幺九",
  closed_kan: "暗杠中张",
  open_kan: "明杠中张",
  closed_terminal_kan: "暗杠幺九",
  open_terminal_kan: "明杠幺九",
};

const seatOrder = ["east", "south", "west", "north"];
const seatLabels = {
  east: "东",
  south: "南",
  west: "西",
  north: "北",
};

const appSession = {
  mode: "game",
  playerId: getOrCreatePlayerId(),
  playerName: localStorage.getItem("thirteenOrphansPlayerName") || "",
};

const state = {
  closedTiles: [],
  winTile: null,
  melds: [],
  round: {
    isTsumo: false,
    isDealer: false,
    playerWind: "south",
    roundWind: "east",
    honba: 0,
  },
  flags: Object.fromEntries(Object.keys(flagLabels).map((key) => [key, false])),
  doraIndicators: [],
  uraDoraIndicators: [],
  manualDoraCount: null,
  manualUraDoraCount: 0,
  options: {
    hasOpenTanyao: true,
    hasAkaDora: true,
  },
};

const history = [];
let inputTarget = "hand";
let meldBuffer = [];
let isPickerCollapsed = false;
let roomPollTimer = null;

const game = {
  rooms: [],
  room: null,
  roomId: localStorage.getItem("thirteenOrphansRoomId") || null,
  isRestoringRoom: Boolean(localStorage.getItem("thirteenOrphansRoomId")),
  settlement: {
    active: false,
    winnerSeat: null,
    loserSeat: null,
    pending: null,
  },
  messageText: "",
  messageIsError: false,
};

const $ = (id) => document.getElementById(id);

function getOrCreatePlayerId() {
  const existing = localStorage.getItem("thirteenOrphansPlayerId");
  if (existing) return existing;
  const generated = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("thirteenOrphansPlayerId", generated);
  return generated;
}

function snapshot() {
  return JSON.stringify(state);
}

function restore(value) {
  const parsed = JSON.parse(value);
  Object.assign(state, parsed);
}

function isGameSettlementActive() {
  return appSession.mode === "game" && game.settlement.active;
}

function resetHandInput() {
  state.closedTiles = [];
  state.winTile = null;
  state.melds = [];
  state.doraIndicators = [];
  state.uraDoraIndicators = [];
  state.manualDoraCount = null;
  state.manualUraDoraCount = 0;
  state.flags = Object.fromEntries(Object.keys(flagLabels).map((key) => [key, false]));
  meldBuffer = [];
  inputTarget = "hand";
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 80) history.shift();
}

function baseTile(tile) {
  return tile.startsWith("0") ? `5${tile[1]}` : tile;
}

function redTileFor(tile) {
  const base = baseTile(tile);
  return base[0] === "5" && ["m", "p", "s"].includes(base[1]) ? `0${base[1]}` : null;
}

function hasRedFive(tile) {
  const red = redTileFor(tile);
  if (!red) return false;
  if (state.closedTiles.includes(red)) return true;
  return state.melds.some((meld) => meld.tiles.includes(red));
}

function isRedTile(tile) {
  return tile[0] === "0";
}

function tileSortValue(tile) {
  const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
  const number = tile[0] === "0" ? 5 : Number(tile[0]);
  const redBias = tile[0] === "0" ? -0.2 : 0;
  return suitOrder[tile[1]] * 10 + number + redBias;
}

function countInHand(tile) {
  const base = baseTile(tile);
  let count = state.closedTiles.filter((item) => baseTile(item) === base).length;
  for (const meld of state.melds) {
    count += meld.tiles.filter((item) => baseTile(item) === base).length;
  }
  return count;
}

function countExactInHand(tile) {
  let count = state.closedTiles.filter((item) => item === tile).length;
  for (const meld of state.melds) {
    count += meld.tiles.filter((item) => item === tile).length;
  }
  return count;
}

function canAddTiles(tiles) {
  const baseNeeds = new Map();
  const redNeeds = new Map();
  tiles.forEach((tile) => {
    const base = baseTile(tile);
    baseNeeds.set(base, (baseNeeds.get(base) || 0) + 1);
    if (isRedTile(tile)) redNeeds.set(tile, (redNeeds.get(tile) || 0) + 1);
  });
  const exceedsBaseLimit = [...baseNeeds.entries()].some(([tile, amount]) => countInHand(tile) + amount > 4);
  const exceedsRedLimit = [...redNeeds.entries()].some(([tile, amount]) => countExactInHand(tile) + amount > 1);
  return !exceedsBaseLimit && !exceedsRedLimit;
}

function canAdd(tile, amount = 1) {
  return canAddTiles(Array.from({ length: amount }, () => tile));
}

function tileButton(tile, onClick, className = "") {
  const button = document.createElement("button");
  button.className = `tile ${className}`;
  button.type = "button";
  button.dataset.tile = tile;
  button.setAttribute("aria-label", tileLabel(tile));
  button.innerHTML = `<img src="/img/${tile}.png" alt="${tileLabel(tile)}" />`;
  button.addEventListener("click", onClick);
  return button;
}

function tileLabel(tile) {
  if (honorLabels[tile]) return honorLabels[tile];
  const number = tile[0] === "0" ? "红五" : tile[0];
  return `${number}${suitLabels[tile[1]] || ""}`;
}

function renderPicker() {
  const picker = $("tilePicker");
  picker.innerHTML = "";
  for (const [label, tiles] of Object.entries(tileGroups)) {
    const row = document.createElement("div");
    row.className = "picker-row";
    row.innerHTML = `<span>${label}</span>`;
    const tileWrap = document.createElement("div");
    tileWrap.className = "picker-tiles";
    tiles.forEach((tile) => tileWrap.append(tileButton(tile, () => handleTilePick(tile))));
    row.append(tileWrap);
    picker.append(row);
  }
  updatePickerAvailability();
}

function renderFlags() {
  const grid = $("flagGrid");
  grid.innerHTML = "";
  for (const [key, label] of Object.entries(flagLabels)) {
    const button = document.createElement("button");
    button.className = `flag ${state.flags[key] ? "active" : ""}`;
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      pushHistory();
      toggleFlag(state.flags, key);
      render();
    });
    grid.append(button);
  }
}

function render() {
  syncGameSettlementRound();
  state.closedTiles.sort((a, b) => tileSortValue(a) - tileSortValue(b));
  renderHand();
  renderMelds();
  renderCalcMemory();
  renderIndicators("doraTiles", state.doraIndicators);
  renderIndicators("uraTiles", state.uraDoraIndicators);
  renderFlags();
  updateControls();
  updateStatus();
  renderMode();
}

function renderHand() {
  const container = $("handTiles");
  container.innerHTML = "";
  container.classList.toggle("empty", state.closedTiles.length === 0);
  if (!state.closedTiles.length) {
    container.textContent = "点击下方牌图添加手牌";
    return;
  }
  state.closedTiles.forEach((tile, index) => {
    container.append(handTileButton(tile, index));
  });
}

function handTileButton(tile, index) {
  const className = state.winTile === tile ? "win" : "";
  const button = tileButton(tile, () => removeClosedTile(Number(button.dataset.index)), className);
  button.dataset.index = String(index);
  return button;
}

function insertClosedTileSorted(tile) {
  const sortValue = tileSortValue(tile);
  const index = state.closedTiles.findIndex((item) => tileSortValue(item) > sortValue);
  const insertIndex = index === -1 ? state.closedTiles.length : index;
  state.closedTiles.splice(insertIndex, 0, tile);
  return insertIndex;
}

function appendClosedTileNode(tile, index) {
  const container = $("handTiles");
  if (state.closedTiles.length === 1) {
    container.innerHTML = "";
    container.classList.remove("empty");
  }
  const button = handTileButton(tile, index);
  container.insertBefore(button, container.children[index] || null);
  reindexHandButtons(index);
}

function removeClosedTileNode(index) {
  const container = $("handTiles");
  const button = container.children[index];
  if (button) button.remove();
  if (!state.closedTiles.length) {
    container.classList.add("empty");
    container.textContent = "点击下方牌图添加手牌";
    return;
  }
  reindexHandButtons(index);
}

function reindexHandButtons(startIndex = 0) {
  const buttons = $("handTiles").querySelectorAll(".tile");
  for (let index = startIndex; index < buttons.length; index += 1) {
    buttons[index].dataset.index = String(index);
  }
}

function updateAfterHandPatch() {
  renderCalcMemory();
  updateControls();
  updateStatus();
  updatePickerHeight();
}

function renderMelds() {
  const container = $("melds");
  container.innerHTML = "";
  const hasPending = inputTarget === "meld" && meldBuffer.length > 0;
  container.classList.toggle("empty", state.melds.length === 0 && !hasPending);
  if (!state.melds.length && !hasPending) {
    container.textContent = "暂无副露";
    return;
  }
  if (hasPending) {
    const pending = document.createElement("div");
    pending.className = "meld-card pending";
    pending.innerHTML = `<span class="meld-label">选择中</span>`;
    meldBuffer.forEach((tile) => pending.append(tileButton(tile, () => {})));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "清";
    clear.addEventListener("click", () => {
      meldBuffer = [];
      render();
    });
    pending.append(clear);
    container.append(pending);
  }
  state.melds.forEach((meld, index) => {
    const card = document.createElement("div");
    card.className = "meld-card";
    card.innerHTML = `<span class="meld-label">${meldLabels[meld.type]}</span>`;
    meld.tiles.forEach((tile) => card.append(tileButton(tile, () => {})));
    if (meld.type === "pon" && canUpgradePonToKan(meld)) {
      const upgrade = document.createElement("button");
      upgrade.type = "button";
      upgrade.className = "meld-upgrade";
      upgrade.textContent = "杠";
      upgrade.addEventListener("click", async () => {
        const type = await chooseKanType();
        if (!type) return;
        pushHistory();
        state.melds[index] = {
          type,
          tiles: tilesForUpgradedKan(meld),
          opened: type !== "ankan",
        };
        normalizeFlags();
        render();
      });
      card.append(upgrade);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删";
    remove.addEventListener("click", () => {
      pushHistory();
      state.melds.splice(index, 1);
      normalizeFlags();
      render();
    });
    card.append(remove);
    container.append(card);
  });
}

function renderCalcMemory() {
  const container = $("calcMemory");
  container.innerHTML = "";
  const winTile = getStoredWinTile();
  const manualDoraTotal = getManualDoraTotal();
  const hasManualDoraTotal = shouldUseManualDoraTotal();
  container.classList.toggle("empty", !winTile && !hasManualDoraTotal);

  if (!winTile && !hasManualDoraTotal) {
    container.textContent = "和牌与宝牌数量会在第一次计算后保留";
    return;
  }

  if (winTile) {
    container.append(createMemoryItem("和牌", winTile, () => {
      pushHistory();
      state.winTile = null;
      render();
    }, true));
  }

  if (hasManualDoraTotal) {
    container.append(createMemoryItem("宝牌总数", `${manualDoraTotal} 张`, () => {
      pushHistory();
      clearManualDoraTotal();
      render();
    }));
  }
}

function createMemoryItem(label, value, onRemove, isTile = false) {
  const item = document.createElement("div");
  item.className = "memory-item";
  const text = document.createElement("span");
  text.className = "memory-label";
  text.textContent = label;
  item.append(text);
  if (isTile) {
    item.append(tileButton(value, () => {}, "win"));
  } else {
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(strong);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "删";
  remove.addEventListener("click", onRemove);
  item.append(remove);
  return item;
}

function renderIndicators(id, tiles) {
  const container = $(id);
  container.innerHTML = "";
  container.classList.toggle("empty", tiles.length === 0);
  if (!tiles.length) {
    container.textContent = "暂无";
    return;
  }
  tiles.forEach((tile, index) => {
    container.append(tileButton(tile, () => {
      pushHistory();
      tiles.splice(index, 1);
      render();
    }));
  });
}

function updateControls() {
  const roundReadOnly = isGameSettlementActive();
  $("undoBtn").disabled = history.length === 0;
  const picker = document.querySelector(".picker");
  const togglePickerBtn = $("togglePickerBtn");
  picker.classList.toggle("collapsed", isPickerCollapsed);
  togglePickerBtn.textContent = isPickerCollapsed ? "展开" : "收起";
  togglePickerBtn.setAttribute("aria-expanded", String(!isPickerCollapsed));
  $("modeScoreBtn").classList.toggle("active", appSession.mode === "score");
  $("modeGameBtn").classList.toggle("active", appSession.mode === "game");
  $("calculateBtn").textContent = appSession.mode === "game" && game.settlement.active ? "结算" : "计算";
  $("isDealer").checked = state.round.isDealer;
  $("isDealer").disabled = roundReadOnly;
  $("honbaValue").textContent = state.round.honba;
  $("hasOpenTanyao").checked = state.options.hasOpenTanyao;
  $("hasAkaDora").checked = state.options.hasAkaDora;
  updatePickerAvailability();
  updateRoundAutoSummary();
  document.querySelectorAll("[data-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === inputTarget);
  });
  document.querySelectorAll("[data-wind]").forEach((group) => {
    const key = group.dataset.wind;
    group.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state.round[key]);
      button.disabled = roundReadOnly || (key === "playerWind" && state.round.isDealer && button.dataset.value !== "east");
    });
  });
  document.querySelectorAll("[data-bind='round.isTsumo']").forEach((button) => {
    const showWinMethod = !roundReadOnly || Boolean(game.settlement.pending);
    button.classList.toggle("active", showWinMethod && String(state.round.isTsumo) === button.dataset.value);
    button.disabled = roundReadOnly;
  });
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.disabled = roundReadOnly;
  });
  $("meldHint").textContent = inputTarget === "meld" && meldBuffer.length
    ? `副露：已选 ${meldBuffer.length} 张，继续选择完成吃/碰`
    : "切到副露后点 3 张自动识别吃/碰；碰旁边可点杠升级。";
}

function updateRoundAutoSummary() {
  const container = $("roundAutoSummary");
  if (!container) return;
  const visible = isGameSettlementActive();
  container.hidden = !visible;
  if (!visible) {
    container.innerHTML = "";
    return;
  }
  const room = game.room;
  const round = room?.round;
  const winnerSeat = game.settlement.winnerSeat;
  const seat = room?.seats?.[winnerSeat];
  const roundLabel = round?.label || `${seatLabels[state.round.roundWind]}场 ${state.round.honba}本场`;
  const winnerText = winnerSeat ? seatDisplayName(winnerSeat) : "当前玩家";
  const riichiSticks = Number(round?.riichiSticks || 0);
  const outcomeText = game.settlement.pending
    ? state.round.isTsumo
      ? "自摸"
      : `荣和 ${seatDisplayName(game.settlement.loserSeat)}放铳`
    : "结算时选择";
  const specialFlags = activeFlagLabels().join("、") || "无";
  container.innerHTML = `
    <span>对局自动带入</span>
    <strong>${escapeHtml(roundLabel)} · ${escapeHtml(winnerText)}</strong>
    <div>
      <span>场风 ${seatLabels[state.round.roundWind]}</span>
      <span>自风 ${seatLabels[state.round.playerWind]}</span>
      <span>${state.round.isDealer ? "庄家" : "子家"}</span>
      <span>${state.round.honba} 本场</span>
      <span>供托 ${riichiSticks}</span>
      <span>和牌方式 ${escapeHtml(outcomeText)}</span>
      <span>特殊役 ${escapeHtml(specialFlags)}</span>
    </div>
    ${seat?.riichiDeclared ? "<small>立直已自动带入</small>" : ""}
  `;
}

function canPickTile(tile) {
  if (inputTarget === "dora" || inputTarget === "ura") return true;
  const pendingTiles = inputTarget === "meld" ? [...meldBuffer, tile] : [tile];
  return canAddTiles(pendingTiles);
}

function updatePickerAvailability() {
  document.querySelectorAll("#tilePicker .tile[data-tile]").forEach((button) => {
    const unavailable = !canPickTile(button.dataset.tile);
    button.disabled = unavailable;
    button.classList.toggle("unavailable", unavailable);
    button.title = unavailable ? "这张牌已达可选上限" : "";
  });
}

function showTileLimitError(tile) {
  if (isRedTile(tile) && countExactInHand(tile) >= 1) {
    showError("每种红五最多 1 张");
    return;
  }
  showError("同一种牌最多 4 张");
}

function updateStatus() {
  if (appSession.mode === "game" && !game.settlement.active) {
    const roomText = game.room ? `${game.room.name} · ${game.room.round.label}` : "对局 · 未进入房间";
    $("statusText").textContent = roomText;
    return;
  }
  const targetCount = targetClosedTileCount();
  const winTile = getStoredWinTile();
  const doraText = shouldUseManualDoraTotal() ? ` · 宝牌总数 ${getManualDoraTotal()}` : "";
  const status = `手牌 ${state.closedTiles.length}/${targetCount} · 副露 ${state.melds.length} · ${
    winTile ? `和牌 ${winTile}` : "计算时选择和牌"
  }${doraText}`;
  $("statusText").textContent = status;
}

function targetClosedTileCount() {
  return 14 - state.melds.length * 3;
}

function setPickerCollapsed(collapsed) {
  isPickerCollapsed = collapsed;
  updateControls();
  updatePickerHeight();
}

function handleTilePick(tile) {
  if (inputTarget === "meld") {
    if (!canPickTile(tile)) {
      showTileLimitError(tile);
      return;
    }
    addMeldPick(tile);
    return;
  }
  if (inputTarget === "dora") {
    pushHistory();
    state.doraIndicators.push(tile);
    clearManualDoraTotal();
  } else if (inputTarget === "ura") {
    pushHistory();
    state.uraDoraIndicators.push(tile);
    clearManualDoraTotal();
  } else if (canAdd(tile)) {
    pushHistory();
    const index = insertClosedTileSorted(tile);
    appendClosedTileNode(tile, index);
    if (state.closedTiles.length >= targetClosedTileCount()) {
      isPickerCollapsed = true;
    }
    updateAfterHandPatch();
    return;
  } else {
    showTileLimitError(tile);
    return;
  }
  render();
}

async function addMeldPick(tile) {
  meldBuffer.push(tile);
  if (meldBuffer.length < 3) {
    render();
    return;
  }

  const tiles = [...meldBuffer];
  if (tiles.length === 3) {
    const type = detectThreeTileMeld(tiles);
    if (!type) {
      showError("副露需选择连续三张数牌，或三/四张相同牌");
      meldBuffer = [];
      render();
      return;
    }
    if (type === "pon" && !canAddTiles(tiles)) {
      showError("副露会超过 4 张限制");
      meldBuffer = [];
      render();
      return;
    }
    commitMeld(type, tiles);
    return;
  }

  if (tiles.length === 4) {
    if (!isSame(tiles, 4) || !canAddTiles(tiles)) {
      showError("杠必须选择四张相同牌，且不能超过 4 张限制");
      meldBuffer = [];
      render();
      return;
    }
    const type = await chooseKanType();
    if (!type) {
      meldBuffer = [];
      render();
      return;
    }
    commitMeld(type, tiles);
  }
}

function detectThreeTileMeld(tiles) {
  if (isChi(tiles)) return "chi";
  if (isSame(tiles, 3)) return "pon";
  return null;
}

function isSame(tiles, size) {
  return tiles.length === size && new Set(tiles.map(baseTile)).size === 1;
}

function commitMeld(type, tiles) {
  if (!canAddTiles(tiles)) {
    showError("副露会超过 4 张限制");
    meldBuffer = [];
    render();
    return;
  }
  pushHistory();
  state.melds.push({
    type,
    tiles: tiles.sort((a, b) => tileSortValue(a) - tileSortValue(b)),
    opened: type !== "ankan",
  });
  meldBuffer = [];
  normalizeFlags();
  render();
}

function canUpgradePonToKan(meld) {
  if (!meld.tiles.length || !isSame(meld.tiles, 3)) return false;
  return canAdd(baseTile(meld.tiles[0]), 1);
}

function tilesForUpgradedKan(meld) {
  const base = baseTile(meld.tiles[0]);
  const red = redTileFor(base);
  const useRed = state.options.hasAkaDora && red && !meld.tiles.includes(red) && !hasRedFive(base);
  const tiles = useRed ? [red, ...meld.tiles] : [...meld.tiles, base];
  return tiles.sort((a, b) => tileSortValue(a) - tileSortValue(b));
}

function isChi(tiles) {
  const suits = new Set(tiles.map((tile) => tile[1]));
  if (suits.size !== 1 || suits.has("z")) return false;
  const numbers = tiles.map((tile) => tile[0] === "0" ? 5 : Number(tile[0])).sort((a, b) => a - b);
  return numbers[1] === numbers[0] + 1 && numbers[2] === numbers[1] + 1;
}

function removeClosedTile(index) {
  const tile = state.closedTiles[index];
  if (!tile) return;
  pushHistory();
  state.closedTiles.splice(index, 1);
  if (state.winTile === tile && !state.closedTiles.includes(tile)) state.winTile = null;
  removeClosedTileNode(index);
  updateAfterHandPatch();
}

function chooseKanType() {
  return showChoice("选择杠类型", [
    { value: "kan", label: "明杠" },
    { value: "ankan", label: "暗杠" },
    { value: "shouminkan", label: "加杠" },
  ]);
}

function chooseWinTile() {
  const stored = getStoredWinTile();
  if (stored) return Promise.resolve(stored);
  const choices = [...state.closedTiles]
    .sort((a, b) => tileSortValue(a) - tileSortValue(b))
    .map((tile) => ({ value: tile, tile }));
  return showChoice("选择和牌", choices);
}

function shouldAskManualDoraCounts() {
  return state.doraIndicators.length === 0
    && state.uraDoraIndicators.length === 0
    && !shouldUseManualDoraTotal();
}

async function chooseManualDoraCounts() {
  const total = await showCountChoice("选择宝牌总数量");
  if (total === null) return null;
  return { doraCount: total, uraDoraCount: 0 };
}

function getStoredWinTile() {
  return state.winTile && state.closedTiles.includes(state.winTile) ? state.winTile : null;
}

function getManualDoraTotal() {
  return Number(state.manualDoraCount || 0) + Number(state.manualUraDoraCount || 0);
}

function shouldUseManualDoraTotal() {
  return state.manualDoraCount !== null
    && state.manualDoraCount !== undefined
    && state.doraIndicators.length === 0
    && state.uraDoraIndicators.length === 0;
}

function clearManualDoraTotal() {
  state.manualDoraCount = null;
  state.manualUraDoraCount = 0;
}

function showChoice(title, choices) {
  const dialog = $("choiceDialog");
  const body = $("choiceBody");
  dialog.returnValue = "";
  dialog.classList.remove("count-dialog");
  $("choiceTitle").textContent = title;
  body.innerHTML = "";
  body.classList.remove("count-choice-body");
  choices.forEach((choice) => {
    const button = choice.tile
      ? tileButton(choice.tile, () => dialog.close(choice.value))
      : document.createElement("button");
    if (!choice.tile) {
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", () => dialog.close(choice.value));
    }
    body.append(button);
  });
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "cancel" || dialog.returnValue === "" ? null : dialog.returnValue);
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function showCountChoice(title) {
  const values = Array.from({ length: 21 }, (_, index) => index);
  const choices = values.map((value) => ({ value, label: String(value) }));
  const dialog = $("choiceDialog");
  const body = $("choiceBody");
  dialog.returnValue = "";
  dialog.classList.add("count-dialog");
  $("choiceTitle").textContent = title;
  body.innerHTML = "";
  body.classList.add("count-choice-body");
  const note = document.createElement("p");
  note.className = "count-choice-note";
  note.textContent = "未选择指示牌时，直接输入宝牌加里宝牌的总数量。选过后会保留，删除后可重选。";
  const row = document.createElement("div");
  row.className = "count-choice-row";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "count-choice";
    if (choice.value <= 5) button.classList.add("recommended");
    button.textContent = choice.label;
    button.setAttribute("aria-label", `${choice.value} 张`);
    button.addEventListener("click", () => dialog.close(String(choice.value)));
    row.append(button);
  });
  body.append(note);
  body.append(row);
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      dialog.classList.remove("count-dialog");
      body.classList.remove("count-choice-body");
      resolve(dialog.returnValue === "cancel" || dialog.returnValue === "" ? null : Number(dialog.returnValue));
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function showWinOutcomeChoice(winnerSeat) {
  const dialog = $("choiceDialog");
  const body = $("choiceBody");
  dialog.returnValue = "";
  dialog.classList.remove("count-dialog");
  $("choiceTitle").textContent = "选择和牌方式";
  body.innerHTML = "";
  body.className = "choice-body win-outcome-body";

  const tsumo = document.createElement("button");
  tsumo.type = "button";
  tsumo.className = "win-outcome-tsumo";
  tsumo.textContent = "自摸";
  tsumo.addEventListener("click", () => dialog.close("tsumo"));
  body.append(tsumo);

  const ronRow = document.createElement("div");
  ronRow.className = "win-outcome-ron-row";
  seatOrder
    .filter((seat) => seat !== winnerSeat && game.room.seats[seat].player)
    .forEach((seat) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = seatDisplayName(seat);
      button.addEventListener("click", () => dialog.close(seat));
      ronRow.append(button);
    });
  body.append(ronRow);

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      body.className = "choice-body";
      resolve(dialog.returnValue === "cancel" || dialog.returnValue === "" ? null : dialog.returnValue);
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function showDirectSettlementDialog(winnerSeat) {
  const room = game.room;
  if (!room) return Promise.resolve(null);
  const dialog = $("choiceDialog");
  const body = $("choiceBody");
  const actions = dialog.querySelector(".dialog-actions");
  const confirm = document.createElement("button");
  let selectedPayload = null;

  dialog.returnValue = "";
  dialog.classList.remove("count-dialog", "special-yaku-dialog");
  dialog.classList.add("direct-score-dialog");
  $("choiceTitle").textContent = "直接录点";
  body.innerHTML = "";
  body.className = "choice-body direct-score-body";

  const ronOptions = seatOrder
    .filter((seat) => seat !== winnerSeat && room.seats[seat].player)
    .map((seat) => `
      <label class="direct-choice">
        <input type="radio" name="directOutcome" value="${seat}" />
        <span>荣和 ${escapeHtml(seatDisplayName(seat))}</span>
      </label>
    `)
    .join("");
  const riichiOptions = seatOrder
    .filter((seat) => room.seats[seat].player)
    .map((seat) => {
      const item = room.seats[seat];
      const alreadyDeclared = Boolean(item.riichiDeclared);
      const cannotDeclare = !alreadyDeclared && Number(item.score || 0) < 1000;
      return `
        <label class="direct-choice ${cannotDeclare ? "disabled" : ""}">
          <input type="checkbox" name="directRiichi" value="${seat}" ${alreadyDeclared ? "checked" : ""} ${cannotDeclare ? "disabled" : ""} />
          <span>${escapeHtml(seatDisplayName(seat))}</span>
        </label>
      `;
    })
    .join("");

  body.innerHTML = `
    <div class="direct-score-section">
      <strong>和牌方式</strong>
      <div class="direct-choice-grid">
        <label class="direct-choice">
          <input type="radio" name="directOutcome" value="tsumo" checked />
          <span>自摸</span>
        </label>
        ${ronOptions}
      </div>
    </div>
    <div class="direct-score-section">
      <strong>点数</strong>
      <div id="directScoreInputs" class="direct-score-inputs"></div>
    </div>
    <div class="direct-score-section">
      <strong>立直</strong>
      <div class="direct-choice-grid">${riichiOptions}</div>
    </div>
    <p id="directScoreError" class="direct-score-error" role="alert"></p>
  `;

  confirm.type = "button";
  confirm.className = "primary direct-score-confirm";
  confirm.textContent = "确定扣分";
  actions.prepend(confirm);

  const selectedOutcome = () => body.querySelector("input[name='directOutcome']:checked")?.value || "tsumo";
  const errorNode = () => body.querySelector("#directScoreError");
  const scoreInputs = () => body.querySelector("#directScoreInputs");
  const winnerIsDealer = winnerSeat === room.round.dealerSeat;

  const updateScoreFields = () => {
    const outcome = selectedOutcome();
    const isTsumo = outcome === "tsumo";
    const inputs = scoreInputs();
    if (!inputs) return;
    if (isTsumo && winnerIsDealer) {
      inputs.innerHTML = directScoreInputHtml("directMain", "每家支付", "例如 4000");
    } else if (isTsumo) {
      inputs.innerHTML = `
        ${directScoreInputHtml("directMain", "亲家支付", "例如 4000")}
        ${directScoreInputHtml("directAdditional", "子家支付", "例如 2000")}
      `;
    } else {
      inputs.innerHTML = directScoreInputHtml("directMain", "放铳支付", "例如 8000");
    }
    inputs.querySelector("input")?.focus();
  };

  body.querySelectorAll("input[name='directOutcome']").forEach((input) => {
    input.addEventListener("change", updateScoreFields);
  });
  updateScoreFields();

  confirm.addEventListener("click", () => {
    const outcome = selectedOutcome();
    const isTsumo = outcome === "tsumo";
    const mainInput = body.querySelector("input[name='directMain']");
    const mainLabel = isTsumo && winnerIsDealer ? "每家支付" : isTsumo ? "亲家支付" : "放铳支付";
    const mainResult = parseDirectPayment(mainInput?.value, mainLabel);
    if (!mainResult.ok) {
      errorNode().textContent = mainResult.error;
      mainInput?.focus();
      return;
    }

    let additional = 0;
    if (isTsumo && !winnerIsDealer) {
      const additionalInput = body.querySelector("input[name='directAdditional']");
      const additionalResult = parseDirectPayment(additionalInput?.value, "子家支付");
      if (!additionalResult.ok) {
        errorNode().textContent = additionalResult.error;
        additionalInput?.focus();
        return;
      }
      additional = additionalResult.amount;
    }

    selectedPayload = {
      loserSeat: isTsumo ? null : outcome,
      directScore: {
        isTsumo,
        main: mainResult.amount,
        additional,
      },
      riichiSeats: [...body.querySelectorAll("input[name='directRiichi']:checked")].map((input) => input.value),
    };
    dialog.close("confirm");
  });

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      confirm.remove();
      dialog.classList.remove("direct-score-dialog");
      body.className = "choice-body";
      resolve(dialog.returnValue === "confirm" ? selectedPayload : null);
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function directScoreInputHtml(name, label, placeholder) {
  return `
    <label class="direct-score-input">
      <span>${label}</span>
      <input name="${name}" type="number" inputmode="numeric" min="100" step="100" placeholder="${placeholder}" required />
    </label>
  `;
}

function parseDirectPayment(value, label) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: `请填写${label}` };
  const amount = Number(text);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: `${label}必须大于 0` };
  if (amount % 100 !== 0) return { ok: false, error: `${label}必须是 100 的倍数` };
  return { ok: true, amount };
}

function chooseGameSpecialYakuFlags() {
  return showSpecialYakuChoice("选择特殊役种", state.flags);
}

function showSpecialYakuChoice(title, initialFlags) {
  const dialog = $("choiceDialog");
  const body = $("choiceBody");
  const hasOpenMeld = state.melds.some((meld) => meld.opened);
  const draft = normalizeFlagSet({ ...initialFlags }, hasOpenMeld);

  dialog.returnValue = "";
  dialog.classList.remove("count-dialog");
  dialog.classList.add("special-yaku-dialog");
  $("choiceTitle").textContent = title;
  body.innerHTML = "";
  body.className = "choice-body special-yaku-body";

  const grid = document.createElement("div");
  grid.className = "special-yaku-grid";

  const renderDraft = () => {
    grid.innerHTML = "";
    for (const [key, label] of Object.entries(flagLabels)) {
      const button = document.createElement("button");
      const disabled = hasOpenMeld && ["isRiichi", "isDoubleRiichi", "isIppatsu"].includes(key);
      button.type = "button";
      button.className = `special-yaku-toggle ${draft[key] ? "active" : ""}`;
      button.textContent = label;
      button.disabled = disabled;
      if (disabled) button.title = "有开放副露时不能选择";
      button.addEventListener("click", () => {
        toggleFlag(draft, key, hasOpenMeld);
        renderDraft();
      });
      grid.append(button);
    }
  };

  const actions = document.createElement("div");
  actions.className = "special-yaku-actions";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "ghost";
  clear.textContent = "清空";
  clear.addEventListener("click", () => {
    Object.keys(draft).forEach((key) => {
      draft[key] = false;
    });
    renderDraft();
  });
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "primary";
  confirm.textContent = "确认";
  confirm.addEventListener("click", () => dialog.close("confirm"));
  actions.append(clear, confirm);

  renderDraft();
  body.append(grid, actions);

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      dialog.classList.remove("special-yaku-dialog");
      body.className = "choice-body";
      resolve(dialog.returnValue === "confirm" ? { ...draft } : null);
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

function scrollToResult() {
  requestAnimationFrame(() => {
    $("result").scrollIntoView({ behavior: "smooth", block: "end" });
  });
}

function scrollToHandInput() {
  requestAnimationFrame(() => {
    document.querySelector(".hand-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function normalizeFlags() {
  normalizeFlagSet(state.flags);
}

function toggleFlag(flags, key, hasOpenMeld = state.melds.some((meld) => meld.opened)) {
  flags[key] = !flags[key];
  if (flags[key]) {
    if (key === "isRiichi") flags.isDoubleRiichi = false;
    if (key === "isDoubleRiichi") flags.isRiichi = false;
    if (key === "isHaitei") flags.isHoutei = false;
    if (key === "isHoutei") flags.isHaitei = false;
  }
  return normalizeFlagSet(flags, hasOpenMeld);
}

function normalizeFlagSet(flags, hasOpenMeld = state.melds.some((meld) => meld.opened)) {
  if (hasOpenMeld) {
    flags.isRiichi = false;
    flags.isDoubleRiichi = false;
    flags.isIppatsu = false;
  }
  if (flags.isRiichi) flags.isDoubleRiichi = false;
  if (flags.isDoubleRiichi) flags.isRiichi = false;
  if (flags.isHaitei) flags.isHoutei = false;
  if (flags.isHoutei) flags.isHaitei = false;
  if (flags.isTenhou || flags.isChiihou) {
    ["isRiichi", "isDoubleRiichi", "isIppatsu", "isHaitei", "isHoutei", "isRinshan", "isChankan"].forEach((key) => {
      flags[key] = false;
    });
  }
  return flags;
}

function activeFlagLabels(flags = state.flags) {
  return Object.entries(flagLabels)
    .filter(([key]) => flags[key])
    .map(([, label]) => label);
}

function showError(message) {
  const result = $("result");
  result.className = "panel result-panel result-error";
  result.textContent = message;
}

function resetResult() {
  const result = $("result");
  result.className = "panel result-panel empty";
  result.innerHTML = `
    <div class="empty-state">
      <p class="section-kicker">Result</p>
      <strong>结果将在这里显示</strong>
      <span>录入手牌后点击底部“计算”。</span>
    </div>
  `;
}

async function calculate() {
  if (appSession.mode === "game" && game.settlement.active) {
    await previewGameSettlement();
    return;
  }
  await calculateScoreOnly();
}

async function prepareHandPayload(options = {}) {
  setPickerCollapsed(true);
  if (!state.closedTiles.length) {
    showError("请先选择手牌");
    return null;
  }
  const winTile = await chooseWinTile();
  if (!winTile) return null;
  let specialFlags = null;
  if (options.askGameSpecialYaku) {
    specialFlags = await chooseGameSpecialYakuFlags();
    if (!specialFlags) return null;
  }
  let manualCounts = null;
  if (shouldAskManualDoraCounts()) {
    manualCounts = await chooseManualDoraCounts();
    if (!manualCounts) return null;
  }
  pushHistory();
  state.winTile = winTile;
  if (specialFlags) {
    state.flags = specialFlags;
    normalizeFlags();
  }
  if (manualCounts) {
    state.manualDoraCount = manualCounts.doraCount;
    state.manualUraDoraCount = manualCounts.uraDoraCount;
  }
  render();
  return {
    ...state,
    manualDoraCount: state.manualDoraCount,
    manualUraDoraCount: state.manualUraDoraCount,
  };
}

async function calculateScoreOnly() {
  const payload = await prepareHandPayload();
  if (!payload) return;
  const result = $("result");
  result.className = "panel result-panel";
  result.textContent = "计算中...";
  scrollToResult();
  try {
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    renderResult(data);
  } catch (error) {
    showError(`请求失败：${error.message}`);
  }
}

function renderResult(data) {
  const result = $("result");
  if (!data.ok) {
    result.className = "panel result-panel result-error";
    result.innerHTML = `<strong>无法计算</strong><p>${data.error}</p>`;
    scrollToResult();
    return;
  }
  const cost = data.cost || {};
  const isTsumo = state.round.isTsumo;
  const mainPayment = (cost.main || 0) + (cost.main_bonus || 0);
  const additionalPayment = (cost.additional || 0) + (cost.additional_bonus || 0);
  const costText = isTsumo
    ? state.round.isDealer
      ? `自摸 每家 ${mainPayment} 点`
      : `自摸 亲 ${mainPayment} 点 / 子 ${additionalPayment} 点`
    : `荣和 ${mainPayment} 点`;
  const bonusText = honbaBonusText(cost, isTsumo, state.round.isDealer);
  result.className = "panel result-panel";
  result.innerHTML = `
    <strong>${costText}</strong>
    <p>${data.han} 番 ${data.fu} 符</p>
    ${bonusText ? `<p>${escapeHtml(bonusText)}</p>` : ""}
    <h3>役种</h3>
    <ul>${data.yaku.map((item) => `<li>${translateYaku(item)}</li>`).join("")}</ul>
    <h3>符明细</h3>
    <ul>${data.fuDetails.map((item) => `<li>${item.fu} 符：${translateFuReason(item.reason)}</li>`).join("")}</ul>
  `;
  scrollToResult();
}

function renderMode() {
  const calcVisible = appSession.mode === "score" || (appSession.mode === "game" && game.settlement.active);
  $("calculatorWorkspace").hidden = !calcVisible;
  $("tileInputArea").hidden = !calcVisible;
  $("gameMode").hidden = appSession.mode !== "game";
  document.body.classList.toggle("picker-hidden", !calcVisible);
  if (appSession.mode === "game") renderGame();
  updatePickerHeight();
}

function setMode(mode) {
  appSession.mode = mode;
  if (mode === "game") {
    startRoomPolling();
    refreshGame();
  } else {
    stopRoomPolling();
  }
  render();
}

function startRoomPolling() {
  if (roomPollTimer) return;
  roomPollTimer = window.setInterval(refreshGame, 2000);
}

function stopRoomPolling() {
  if (!roomPollTimer) return;
  window.clearInterval(roomPollTimer);
  roomPollTimer = null;
}

async function refreshGame() {
  if (appSession.mode !== "game") return;
  if (game.roomId) {
    await fetchCurrentRoom();
  } else {
    game.isRestoringRoom = false;
    await fetchRooms();
  }
}

async function apiRequest(url, options = {}) {
  const fetchOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };
  if (fetchOptions.body && typeof fetchOptions.body !== "string") {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }
  const response = await fetch(url, fetchOptions);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function currentPlayerName() {
  const input = $("playerNameInput");
  const value = (input ? input.value : appSession.playerName || "").trim();
  appSession.playerName = value;
  if (value) {
    localStorage.setItem("thirteenOrphansPlayerName", value);
  } else {
    localStorage.removeItem("thirteenOrphansPlayerName");
  }
  return value;
}

function requirePlayerName() {
  const value = currentPlayerName();
  if (value) return value;
  setGameMessage("请先填写用户名", true);
  $("playerNameInput")?.focus();
  return null;
}

async function fetchRooms() {
  try {
    const data = await apiRequest("/api/rooms");
    game.rooms = data.rooms || [];
    renderGame();
    updateStatus();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

async function fetchCurrentRoom() {
  if (!game.room) {
    game.isRestoringRoom = true;
    renderGame();
  }
  try {
    const data = await apiRequest(`/api/rooms/${game.roomId}?playerId=${encodeURIComponent(appSession.playerId)}`);
    game.room = data.room;
    game.isRestoringRoom = false;
    renderGame();
    updateStatus();
  } catch (error) {
    game.room = null;
    game.roomId = null;
    game.isRestoringRoom = false;
    game.settlement.active = false;
    localStorage.removeItem("thirteenOrphansRoomId");
    setGameMessage(error.message, true);
    await fetchRooms();
  }
}

async function createRoom() {
  const playerName = requirePlayerName();
  if (!playerName) return;
  try {
    const data = await apiRequest("/api/rooms", {
      method: "POST",
      body: {
        playerId: appSession.playerId,
        playerName,
        roomName: $("roomNameInput").value,
      },
    });
    enterRoom(data.room);
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

async function joinRoom(roomId) {
  const playerName = requirePlayerName();
  if (!playerName) return;
  try {
    const data = await apiRequest(`/api/rooms/${roomId}/join`, {
      method: "POST",
      body: {
        playerId: appSession.playerId,
        playerName,
      },
    });
    enterRoom(data.room);
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

function enterRoom(room) {
  game.room = room;
  game.roomId = room.id;
  game.isRestoringRoom = false;
  localStorage.setItem("thirteenOrphansRoomId", room.id);
  game.settlement.active = false;
  render();
}

async function chooseSeat(seat) {
  if (!game.room) return;
  const playerName = requirePlayerName();
  if (!playerName) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/seat`, {
      method: "POST",
      body: {
        playerId: appSession.playerId,
        playerName,
        seat,
      },
    });
    game.room = data.room;
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

async function addTestPlayer() {
  if (!game.room) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/test-player`, {
      method: "POST",
      body: { playerId: appSession.playerId },
    });
    game.room = data.room;
    setGameMessage(`${seatLabels[data.seat]}位已加入测试玩家。`);
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

async function startGameRoom() {
  if (!game.room) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/start`, {
      method: "POST",
      body: { playerId: appSession.playerId },
    });
    game.room = data.room;
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

async function toggleRiichi(seat) {
  if (!game.room) return;
  const declared = !game.room.seats[seat].riichiDeclared;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/riichi`, {
      method: "POST",
      body: {
        playerId: appSession.playerId,
        seat,
        declared,
      },
    });
    game.room = data.room;
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

function canBeginSettlement(seat) {
  return Boolean(game.room?.mySeat && game.room.mySeat === seat && game.room.seats?.[seat]?.player);
}

function beginGameSettlement(winnerSeat) {
  if (!canBeginSettlement(winnerSeat)) {
    setGameMessage("只能录入自己的和牌", true);
    return;
  }
  game.settlement = {
    active: true,
    winnerSeat,
    loserSeat: null,
    pending: null,
  };
  history.length = 0;
  resetHandInput();
  applyRoomRoundToState(winnerSeat);
  resetResult();
  isPickerCollapsed = false;
  render();
  scrollToHandInput();
}

async function beginDirectSettlement(winnerSeat) {
  if (!canBeginSettlement(winnerSeat)) {
    setGameMessage("只能录入自己的和牌", true);
    return;
  }
  const directInput = await showDirectSettlementDialog(winnerSeat);
  if (!directInput) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/settle-direct`, {
      method: "POST",
      body: {
        playerId: appSession.playerId,
        winnerSeat,
        loserSeat: directInput.loserSeat,
        directScore: directInput.directScore,
        riichiSeats: directInput.riichiSeats,
        version: game.room.version,
      },
    });
    game.room = data.room;
    game.settlement = {
      active: false,
      winnerSeat: null,
      loserSeat: null,
      pending: null,
    };
    resetResult();
    setGameMessage("直接录点完成，已更新点数和下一局场况。");
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

function cancelGameSettlement() {
  game.settlement = {
    active: false,
    winnerSeat: null,
    loserSeat: null,
    pending: null,
  };
  resetResult();
  render();
}

function applyRoomRoundToState(winnerSeat, includeRiichiFlag = true) {
  const room = game.room;
  const seat = room?.seats[winnerSeat];
  if (!room || !seat) return;
  state.round.isDealer = Boolean(seat.isDealer);
  state.round.playerWind = seat.currentWind;
  state.round.roundWind = room.round.roundWind;
  state.round.honba = room.round.honba;
  if (includeRiichiFlag && seat.riichiDeclared) state.flags.isRiichi = true;
}

function syncGameSettlementRound() {
  if (isGameSettlementActive()) applyRoomRoundToState(game.settlement.winnerSeat, false);
}

async function previewGameSettlement() {
  if (!game.room || !game.settlement.active) return;
  applyRoomRoundToState(game.settlement.winnerSeat, false);
  const payload = await prepareHandPayload({ askGameSpecialYaku: true });
  if (!payload) return;
  const winOutcome = await chooseWinOutcome(game.settlement.winnerSeat);
  if (!winOutcome) return;
  const isTsumo = winOutcome === "tsumo";
  const loserSeat = isTsumo ? null : winOutcome;
  state.round.isTsumo = isTsumo;
  if (isTsumo) state.flags.isHoutei = false;
  if (!isTsumo) state.flags.isHaitei = false;
  payload.round.isTsumo = isTsumo;
  const result = $("result");
  result.className = "panel result-panel";
  result.textContent = "结算预览中...";
  scrollToResult();
  try {
    const requestBody = {
      playerId: appSession.playerId,
      winnerSeat: game.settlement.winnerSeat,
      loserSeat,
      hand: payload,
      version: game.room.version,
    };
    const data = await apiRequest(`/api/rooms/${game.room.id}/settle-preview`, {
      method: "POST",
      body: requestBody,
    });
    game.settlement.loserSeat = loserSeat;
    game.settlement.pending = requestBody;
    updateControls();
    renderSettlementPreview(data);
  } catch (error) {
    showError(error.message);
  }
}

function chooseWinOutcome(winnerSeat) {
  return showWinOutcomeChoice(winnerSeat);
}

function renderSettlementPreview(data) {
  const result = $("result");
  const handResult = data.result;
  const settlement = data.settlement;
  if (!handResult?.ok) {
    showError(handResult?.error || "无法计算");
    return;
  }
  const paymentItems = settlement.payments.length
    ? settlement.payments.map((payment) => `<li>${paymentText(payment)}</li>`).join("")
    : "<li>无点数转移</li>";
  const bonusText = honbaBonusText(
    handResult.cost,
    settlement.isTsumo,
    settlement.winnerSeat === game.room?.round?.dealerSeat
  );
  const deltaItems = seatOrder
    .map((seat) => {
      const delta = settlement.deltas[seat] || 0;
      const sign = delta > 0 ? "+" : "";
      return `<li>${escapeHtml(seatDisplayName(seat))}：${sign}${delta}</li>`;
    })
    .join("");
  result.className = "panel result-panel";
  result.innerHTML = `
    <strong>${escapeHtml(settlement.roundLabel)} · ${escapeHtml(seatDisplayName(settlement.winnerSeat))} 和牌</strong>
    <p>${handResult.han} 番 ${handResult.fu} 符</p>
    ${bonusText ? `<p>${escapeHtml(bonusText)}</p>` : ""}
    <h3>需要支付</h3>
    <ul>${paymentItems}</ul>
    <h3>点数变动</h3>
    <ul>${deltaItems}</ul>
    <h3>役种</h3>
    <ul>${handResult.yaku.map((item) => `<li>${translateYaku(item)}</li>`).join("")}</ul>
    <div class="settlement-actions">
      <button id="confirmSettlementBtn" class="primary" type="button">确定扣分</button>
      <button id="cancelSettlementPreviewBtn" class="ghost" type="button">取消</button>
    </div>
  `;
  $("confirmSettlementBtn").addEventListener("click", confirmGameSettlement);
  $("cancelSettlementPreviewBtn").addEventListener("click", () => {
    game.settlement.pending = null;
    game.settlement.loserSeat = null;
    resetResult();
    updateControls();
  });
  scrollToResult();
}

async function confirmGameSettlement() {
  if (!game.room || !game.settlement.pending) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/settle`, {
      method: "POST",
      body: game.settlement.pending,
    });
    game.room = data.room;
    cancelGameSettlement();
    setGameMessage("结算完成，已更新点数和下一局场况。");
  } catch (error) {
    showError(error.message);
  }
}

async function undoLastSettlement() {
  if (!game.room || !(game.room.winRecords || []).length) return;
  const latest = game.room.winRecords[game.room.winRecords.length - 1];
  const winner = recordSeatName(latest.winnerSeat, latest.winnerName);
  const confirmed = window.confirm(`撤销 ${latest.roundLabel} ${winner} 的胡牌记录，并恢复到胡牌前场况？`);
  if (!confirmed) return;
  try {
    const data = await apiRequest(`/api/rooms/${game.room.id}/settle/undo`, {
      method: "POST",
      body: { playerId: appSession.playerId },
    });
    game.room = data.room;
    game.settlement = {
      active: false,
      winnerSeat: null,
      loserSeat: null,
      pending: null,
    };
    resetResult();
    setGameMessage("已撤销最近一次胡牌，并恢复到胡牌前场况。");
    render();
  } catch (error) {
    setGameMessage(error.message, true);
  }
}

function renderGame() {
  const lobby = $("roomLobbyPanel");
  if (lobby) lobby.hidden = Boolean(game.room) || game.isRestoringRoom;
  const nameInput = $("playerNameInput");
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = appSession.playerName;
  }
  renderRoomList();
  renderRoomDetail();
  renderGameMessages();
}

function renderRoomList() {
  const list = $("roomList");
  if (!list) return;
  if (!game.rooms.length) {
    list.innerHTML = `<div class="empty-list">暂无房间</div>`;
    return;
  }
  list.innerHTML = game.rooms
    .map((room) => `
      <div class="room-card">
        <div>
          <strong>${escapeHtml(room.name)}</strong>
          <span>${room.status === "playing" ? "对局中" : "等待中"} · ${room.occupied}/${room.capacity} · ${escapeHtml(room.roundLabel)}</span>
        </div>
        <button data-action="joinRoom" data-room-id="${room.id}" type="button">加入</button>
      </div>
    `)
    .join("");
}

function renderRoomDetail() {
  const panel = $("roomPanel");
  if (!panel) return;
  if (!game.room) {
    if (game.isRestoringRoom) {
      panel.hidden = false;
      panel.innerHTML = `<div class="empty-list">正在打开房间...</div>`;
      return;
    }
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const room = game.room;
  const body = room.status === "waiting" ? renderWaitingRoom(room) : renderPlayingRoom(room);
  panel.innerHTML = `
    <div class="room-header">
      <div>
        <p class="section-kicker">Room</p>
        <h2>${escapeHtml(room.name)}</h2>
      </div>
      <button data-action="backRooms" class="ghost" type="button">房间列表</button>
    </div>
    <p id="roomMessage" class="game-message"></p>
    ${body}
  `;
}

function renderWaitingRoom(room) {
  const hasEmptySeat = seatOrder.some((seat) => !room.seats[seat].player);
  const seats = seatOrder.map((seat) => {
    const item = room.seats[seat];
    const isMine = item.player?.id === appSession.playerId;
    const action = item.player
      ? `<span class="seat-state ${isMine ? "mine" : ""}">${isMine ? "我的位置" : "已入座"}</span>`
      : `<button data-action="chooseSeat" data-seat="${seat}" type="button">${room.mySeat ? "换到这里" : "选择位置"}</button>`;
    return `
      <div class="seat-card">
        <span class="seat-wind">${seatLabels[seat]}</span>
        <strong>${item.player ? escapeHtml(item.player.name) : "空位"}</strong>
        ${action}
      </div>
    `;
  }).join("");
  return `
    <p class="room-note">4 个位置坐满后可以开始对局。</p>
    <div class="seat-grid">${seats}</div>
    <div class="room-actions">
      <button data-action="addTestPlayer" class="ghost" type="button" ${hasEmptySeat ? "" : "disabled"}>加入测试玩家</button>
      <button data-action="startRoom" class="primary" type="button" ${room.canStart ? "" : "disabled"}>开始对局</button>
    </div>
  `;
}

function renderPlayingRoom(room) {
  const settlementNotice = game.settlement.active
    ? `<div class="settlement-notice">
        正在为 ${escapeHtml(seatDisplayName(game.settlement.winnerSeat))} 录入和牌，已带入 ${escapeHtml(room.round.label)}。
        <button data-action="cancelSettlement" class="ghost" type="button">取消</button>
      </div>`
    : "";
  const seats = seatOrder.map((seat) => {
    const item = room.seats[seat];
    const name = item.player ? escapeHtml(item.player.name) : "空位";
    return `
      <div class="score-card table-seat seat-${seat} ${item.isDealer ? "dealer" : ""}">
        <div class="score-card-top">
          <span class="seat-wind">${seatLabels[seat]}</span>
          <span>${item.isDealer ? "庄家" : `自风${item.currentWindLabel}`}</span>
        </div>
        <strong>${name}</strong>
        <div class="score-value">${formatScore(item.score)}</div>
        <div class="score-actions">
          <button data-action="toggleRiichi" data-seat="${seat}" type="button">${item.riichiDeclared ? "取消立直" : "立直"}</button>
        </div>
      </div>
    `;
  }).join("");
  const mySeat = room.mySeat || "";
  const canSettle = canBeginSettlement(mySeat);
  return `
    <div class="score-table">
      ${seats}
      <div class="turn-arrow arrow-west-north" aria-label="西到北"><span>摸/打</span><strong>西 ↙ 北</strong></div>
      <div class="turn-arrow arrow-south-west" aria-label="南到西"><span>摸/打</span><strong>南 ↖ 西</strong></div>
      <div class="turn-arrow arrow-north-east" aria-label="北到东"><span>摸/打</span><strong>北 ↘ 东</strong></div>
      <div class="turn-arrow arrow-east-south" aria-label="东到南"><span>摸/打</span><strong>东 ↗ 南</strong></div>
      <div class="table-center">
        <div class="round-strip">
          <span>${escapeHtml(room.round.label)}</span>
          <span>庄家 ${seatLabels[room.round.dealerSeat]}位</span>
          <span>供托 ${room.round.riichiSticks}</span>
        </div>
        <div class="turn-order-note">
          <span>摸牌/打牌顺序</span>
          <strong>东 → 南 → 西 → 北</strong>
        </div>
        <div class="settlement-entry-actions">
          <button data-action="beginSettlement" data-seat="${mySeat}" class="primary settlement-entry-main" type="button" ${canSettle ? "" : "disabled"}>录入胡牌</button>
          <button data-action="directSettlement" data-seat="${mySeat}" class="ghost settlement-entry-direct" type="button" ${canSettle ? "" : "disabled"}>直接录点</button>
        </div>
      </div>
    </div>
    ${settlementNotice}
    ${renderWinRecords(room)}
  `;
}

function renderWinRecords(room) {
  const records = room.winRecords || [];
  const recordFile = room.recordFile ? ` · ${escapeHtml(room.recordFile)}` : "";
  const items = records.length
    ? [...records].reverse().map((record, index) => renderWinRecord(record, index === 0)).join("")
    : `<div class="empty-list">暂无胡牌记录</div>`;
  return `
    <section class="win-records">
      <div class="win-records-header">
        <div>
          <strong>胡牌记录</strong>
          <span>${records.length} 条${recordFile}</span>
        </div>
        <button data-action="undoLastSettlement" class="ghost danger-button" type="button" ${records.length ? "" : "disabled"}>撤销本次胡牌</button>
      </div>
      <div class="win-record-list">${items}</div>
    </section>
  `;
}

function renderWinRecord(record, isLatest) {
  const winner = recordSeatName(record.winnerSeat, record.winnerName);
  const loser = record.loserSeat ? recordSeatName(record.loserSeat, record.loserName) : "";
  const outcome = record.isTsumo ? "自摸" : `荣和 ${loser} 放铳`;
  const directValue = directScoreText(record);
  const valueText = record.han !== null && record.han !== undefined
    ? `${record.han} 番 ${record.fu || "-"} 符`
    : directValue || "计分完成";
  const deltaItems = seatOrder.map((seat) => {
    const delta = Number(record.deltas?.[seat] || 0);
    const sign = delta > 0 ? "+" : "";
    const className = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
    return `
      <span class="delta-item ${className}">
        <small>${seatLabels[seat]}</small>
        <strong>${sign}${delta}</strong>
      </span>
    `;
  }).join("");
  const yaku = (record.yaku || []).length
    ? record.yaku.map((item) => escapeHtml(translateYaku(item))).join("、")
    : "无役种";
  return `
    <details class="win-record" ${isLatest ? "open" : ""}>
      <summary>
        <span class="win-record-index">#${record.index}</span>
        <strong>${escapeHtml(record.roundLabel)} · ${escapeHtml(winner)}</strong>
        <span>${escapeHtml(outcome)} · ${escapeHtml(valueText)}</span>
      </summary>
      <div class="win-record-body">
        <div class="win-record-meta">
          <span>${escapeHtml(formatRecordTime(record.createdAt))}</span>
          <span>供托 ${Number(record.riichiBonus || 0)}</span>
        </div>
        <div class="delta-grid">${deltaItems}</div>
        <p class="win-record-yaku">${yaku}</p>
      </div>
    </details>
  `;
}

function directScoreText(record) {
  const directScore = record.directScore || {};
  const main = Number(directScore.main || 0);
  const additional = Number(directScore.additional || 0);
  if (!main) return "";
  if (!record.isTsumo) return `荣和 ${main} 点`;
  if (additional && additional !== main) return `自摸 亲 ${main} / 子 ${additional} 点`;
  return `自摸 每家 ${main} 点`;
}

function setGameMessage(message, isError = false) {
  game.messageText = message;
  game.messageIsError = isError;
  renderGameMessages();
}

function renderGameMessages() {
  ["gameMessage", "roomMessage"].forEach((id) => {
    const node = $(id);
    if (!node) return;
    node.textContent = game.messageText;
    node.classList.toggle("error", game.messageIsError);
  });
}

function seatDisplayName(seat) {
  if (seat === "riichi") return "供托";
  const item = game.room?.seats?.[seat];
  const name = item?.player?.name || "空位";
  return `${seatLabels[seat]}位 · ${name}`;
}

function paymentText(payment) {
  if (payment.from === "riichi") {
    return `供托 ${payment.amount} 点给 ${escapeHtml(seatDisplayName(payment.to))}`;
  }
  return `${escapeHtml(seatDisplayName(payment.from))} 给 ${escapeHtml(seatDisplayName(payment.to))} ${payment.amount} 点`;
}

function recordSeatName(seat, name) {
  if (!seat) return name || "";
  return `${seatLabels[seat] || seat}位 · ${name || "空位"}`;
}

function formatRecordTime(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", { hour12: false });
}

function formatScore(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function honbaBonusText(cost, isTsumo, isDealer) {
  const mainBonus = Number(cost?.main_bonus || 0);
  const additionalBonus = Number(cost?.additional_bonus || 0);
  if (!mainBonus && !additionalBonus) return "";
  if (!isTsumo) return `本场加成已计入：荣和 +${mainBonus} 点`;
  if (isDealer || mainBonus === additionalBonus) return `本场加成已计入：自摸每家 +${mainBonus} 点`;
  return `本场加成已计入：亲 +${mainBonus} 点 / 子 +${additionalBonus} 点`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function translateFuReason(value) {
  return fuReasonTranslations[value] || value;
}

function translateYaku(value) {
  const exact = yakuTranslations[value];
  if (exact) return exact;
  const numbered = value.match(/^(Dora|Aka Dora|Ura Dora) (\d+)$/);
  if (numbered) return `${yakuTranslations[numbered[1]]} ${numbered[2]}`;
  const yakuhai = value.match(/^Yakuhai \((seat|round) wind (east|south|west|north)\)$/);
  if (yakuhai) {
    const kind = yakuhai[1] === "seat" ? "自风" : "场风";
    const wind = { east: "东", south: "南", west: "西", north: "北" }[yakuhai[2]];
    return `役牌 ${kind}${wind}`;
  }
  return value;
}

function bindEvents() {
  $("modeScoreBtn").addEventListener("click", () => setMode("score"));
  $("modeGameBtn").addEventListener("click", () => setMode("game"));
  $("createRoomBtn").addEventListener("click", createRoom);
  $("refreshRoomsBtn").addEventListener("click", fetchRooms);
  $("playerNameInput").addEventListener("change", currentPlayerName);
  $("gameMode").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, roomId, seat } = button.dataset;
    if (action === "joinRoom") joinRoom(roomId);
    if (action === "backRooms") {
      game.room = null;
      game.roomId = null;
      game.isRestoringRoom = false;
      game.settlement.active = false;
      localStorage.removeItem("thirteenOrphansRoomId");
      fetchRooms();
      render();
    }
    if (action === "chooseSeat") chooseSeat(seat);
    if (action === "addTestPlayer") addTestPlayer();
    if (action === "startRoom") startGameRoom();
    if (action === "toggleRiichi") toggleRiichi(seat);
    if (action === "beginSettlement") beginGameSettlement(seat);
    if (action === "directSettlement") beginDirectSettlement(seat);
    if (action === "cancelSettlement") cancelGameSettlement();
    if (action === "undoLastSettlement") undoLastSettlement();
  });
  $("undoBtn").addEventListener("click", () => {
    const previous = history.pop();
    if (!previous) return;
    restore(previous);
    render();
  });
  $("clearBtn").addEventListener("click", () => {
    pushHistory();
    resetHandInput();
    if (game.settlement.active) applyRoomRoundToState(game.settlement.winnerSeat);
    resetResult();
    render();
  });
  $("calculateBtn").addEventListener("click", calculate);
  $("togglePickerBtn").addEventListener("click", () => {
    setPickerCollapsed(!isPickerCollapsed);
  });
  $("isDealer").addEventListener("change", (event) => {
    if (isGameSettlementActive()) {
      event.target.checked = state.round.isDealer;
      return;
    }
    pushHistory();
    state.round.isDealer = event.target.checked;
    state.round.playerWind = event.target.checked ? "east" : "south";
    render();
  });
  $("hasOpenTanyao").addEventListener("change", (event) => {
    pushHistory();
    state.options.hasOpenTanyao = event.target.checked;
  });
  $("hasAkaDora").addEventListener("change", (event) => {
    pushHistory();
    state.options.hasAkaDora = event.target.checked;
  });
  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      inputTarget = button.dataset.target;
      meldBuffer = [];
      render();
    });
  });
  document.querySelectorAll("[data-wind]").forEach((group) => {
    const key = group.dataset.wind;
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (isGameSettlementActive()) return;
        if (key === "playerWind" && state.round.isDealer && button.dataset.value !== "east") return;
        pushHistory();
        state.round[key] = button.dataset.value;
        if (key === "playerWind") state.round.isDealer = button.dataset.value === "east";
        render();
      });
    });
  });
  document.querySelectorAll("[data-bind='round.isTsumo']").forEach((button) => {
    button.addEventListener("click", () => {
      if (isGameSettlementActive()) return;
      pushHistory();
      state.round.isTsumo = button.dataset.value === "true";
      if (state.round.isTsumo) state.flags.isHoutei = false;
      if (!state.round.isTsumo) state.flags.isHaitei = false;
      render();
    });
  });
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (isGameSettlementActive()) return;
      pushHistory();
      const key = button.dataset.step;
      state.round[key] = Math.max(0, state.round[key] + Number(button.dataset.delta));
      render();
    });
  });
}

function updatePickerHeight() {
  const picker = document.querySelector(".picker");
  if (!picker) return;
  if (picker.hidden) {
    document.documentElement.style.setProperty("--picker-height", "0px");
    return;
  }
  document.documentElement.style.setProperty("--picker-height", `${Math.ceil(picker.getBoundingClientRect().height)}px`);
}

function initializeMode() {
  if (appSession.mode !== "game") return;
  startRoomPolling();
  refreshGame();
}

renderPicker();
bindEvents();
render();
initializeMode();
updatePickerHeight();
window.addEventListener("resize", updatePickerHeight);
if ("ResizeObserver" in window) {
  new ResizeObserver(updatePickerHeight).observe(document.querySelector(".picker"));
}
