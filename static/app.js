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

const $ = (id) => document.getElementById(id);

function snapshot() {
  return JSON.stringify(state);
}

function restore(value) {
  const parsed = JSON.parse(value);
  Object.assign(state, parsed);
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

function canAdd(tile, amount = 1) {
  return countInHand(tile) + amount <= 4;
}

function tileButton(tile, onClick, className = "") {
  const button = document.createElement("button");
  button.className = `tile ${className}`;
  button.type = "button";
  button.dataset.tile = tile;
  button.innerHTML = `<img src="/img/${tile}.png" alt="${tile}" />`;
  button.addEventListener("click", onClick);
  return button;
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
      state.flags[key] = !state.flags[key];
      normalizeFlags();
      render();
    });
    grid.append(button);
  }
}

function render() {
  state.closedTiles.sort((a, b) => tileSortValue(a) - tileSortValue(b));
  renderHand();
  renderMelds();
  renderCalcMemory();
  renderIndicators("doraTiles", state.doraIndicators);
  renderIndicators("uraTiles", state.uraDoraIndicators);
  renderFlags();
  updateControls();
  updateStatus();
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
    const className = state.winTile === tile ? "win" : "";
    const button = tileButton(tile, () => removeClosedTile(index), className);
    container.append(button);
  });
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
  $("undoBtn").disabled = history.length === 0;
  const picker = document.querySelector(".picker");
  const togglePickerBtn = $("togglePickerBtn");
  picker.classList.toggle("collapsed", isPickerCollapsed);
  togglePickerBtn.textContent = isPickerCollapsed ? "展开" : "收起";
  togglePickerBtn.setAttribute("aria-expanded", String(!isPickerCollapsed));
  $("isDealer").checked = state.round.isDealer;
  $("honbaValue").textContent = state.round.honba;
  $("hasOpenTanyao").checked = state.options.hasOpenTanyao;
  $("hasAkaDora").checked = state.options.hasAkaDora;
  document.querySelectorAll("[data-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === inputTarget);
  });
  document.querySelectorAll("[data-wind]").forEach((group) => {
    const key = group.dataset.wind;
    group.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state.round[key]);
      button.disabled = key === "playerWind" && state.round.isDealer && button.dataset.value !== "east";
    });
  });
  document.querySelectorAll("[data-bind='round.isTsumo']").forEach((button) => {
    button.classList.toggle("active", String(state.round.isTsumo) === button.dataset.value);
  });
  $("meldHint").textContent = inputTarget === "meld" && meldBuffer.length
    ? `副露：已选 ${meldBuffer.length} 张，继续选择完成吃/碰`
    : "切到副露后点 3 张自动识别吃/碰；碰旁边可点杠升级。";
}

function updateStatus() {
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
    addMeldPick(tile);
    return;
  }
  pushHistory();
  if (inputTarget === "dora") {
    state.doraIndicators.push(tile);
    clearManualDoraTotal();
  } else if (inputTarget === "ura") {
    state.uraDoraIndicators.push(tile);
    clearManualDoraTotal();
  } else if (canAdd(tile)) {
    state.closedTiles.push(tile);
    if (state.closedTiles.length >= targetClosedTileCount()) {
      isPickerCollapsed = true;
    }
  } else {
    showError("同一种牌最多 4 张");
    history.pop();
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
    if (type === "pon" && !canAdd(tiles[0], 3)) {
      showError("副露会超过 4 张限制");
      meldBuffer = [];
      render();
      return;
    }
    commitMeld(type, tiles);
    return;
  }

  if (tiles.length === 4) {
    if (!isSame(tiles, 4) || !canAdd(tiles[0], 4)) {
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
  const needs = new Map();
  tiles.forEach((tile) => needs.set(baseTile(tile), (needs.get(baseTile(tile)) || 0) + 1));
  const exceedsLimit = [...needs.entries()].some(([tile, amount]) => !canAdd(tile, amount));
  if (exceedsLimit) {
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
  return canAdd(meld.tiles[0], 1);
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
  pushHistory();
  state.closedTiles.splice(index, 1);
  if (state.winTile === tile && !state.closedTiles.includes(tile)) state.winTile = null;
  render();
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
      resolve(dialog.returnValue === "cancel" ? null : dialog.returnValue);
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
      resolve(dialog.returnValue === "cancel" ? null : Number(dialog.returnValue));
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function scrollToResult() {
  requestAnimationFrame(() => {
    $("result").scrollIntoView({ behavior: "smooth", block: "end" });
  });
}

function normalizeFlags() {
  const hasOpenMeld = state.melds.some((meld) => meld.opened);
  if (hasOpenMeld) {
    state.flags.isRiichi = false;
    state.flags.isDoubleRiichi = false;
    state.flags.isIppatsu = false;
  }
  if (state.flags.isRiichi) state.flags.isDoubleRiichi = false;
  if (state.flags.isDoubleRiichi) state.flags.isRiichi = false;
  if (state.flags.isHaitei) state.flags.isHoutei = false;
  if (state.flags.isHoutei) state.flags.isHaitei = false;
  if (state.flags.isTenhou || state.flags.isChiihou) {
    ["isRiichi", "isDoubleRiichi", "isIppatsu", "isHaitei", "isHoutei", "isRinshan", "isChankan"].forEach((key) => {
      state.flags[key] = false;
    });
  }
}

function showError(message) {
  const result = $("result");
  result.className = "panel result-panel result-error";
  result.textContent = message;
}

async function calculate() {
  setPickerCollapsed(true);
  if (!state.closedTiles.length) {
    showError("请先选择手牌");
    return;
  }
  const winTile = await chooseWinTile();
  if (!winTile) return;
  let manualCounts = null;
  if (shouldAskManualDoraCounts()) {
    manualCounts = await chooseManualDoraCounts();
    if (!manualCounts) return;
  }
  pushHistory();
  state.winTile = winTile;
  if (manualCounts) {
    state.manualDoraCount = manualCounts.doraCount;
    state.manualUraDoraCount = manualCounts.uraDoraCount;
  }
  render();
  const result = $("result");
  result.className = "panel result-panel";
  result.textContent = "计算中...";
  scrollToResult();
  const payload = {
    ...state,
    manualDoraCount: state.manualDoraCount,
    manualUraDoraCount: state.manualUraDoraCount,
  };
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
  result.className = "panel result-panel";
  result.innerHTML = `
    <strong>${costText}</strong>
    <p>${data.han} 番 ${data.fu} 符</p>
    <h3>役种</h3>
    <ul>${data.yaku.map((item) => `<li>${translateYaku(item)}</li>`).join("")}</ul>
    <h3>符明细</h3>
    <ul>${data.fuDetails.map((item) => `<li>${item.fu} 符：${translateFuReason(item.reason)}</li>`).join("")}</ul>
  `;
  scrollToResult();
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
  $("undoBtn").addEventListener("click", () => {
    const previous = history.pop();
    if (!previous) return;
    restore(previous);
    render();
  });
  $("clearBtn").addEventListener("click", () => {
    pushHistory();
    state.closedTiles = [];
    state.winTile = null;
    state.melds = [];
    state.doraIndicators = [];
    state.uraDoraIndicators = [];
    state.manualDoraCount = null;
    state.manualUraDoraCount = 0;
    meldBuffer = [];
    render();
  });
  $("calculateBtn").addEventListener("click", calculate);
  $("togglePickerBtn").addEventListener("click", () => {
    setPickerCollapsed(!isPickerCollapsed);
  });
  $("isDealer").addEventListener("change", (event) => {
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
      pushHistory();
      state.round.isTsumo = button.dataset.value === "true";
      if (state.round.isTsumo) state.flags.isHoutei = false;
      if (!state.round.isTsumo) state.flags.isHaitei = false;
      render();
    });
  });
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
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
  document.documentElement.style.setProperty("--picker-height", `${Math.ceil(picker.getBoundingClientRect().height)}px`);
}

renderPicker();
bindEvents();
render();
updatePickerHeight();
window.addEventListener("resize", updatePickerHeight);
if ("ResizeObserver" in window) {
  new ResizeObserver(updatePickerHeight).observe(document.querySelector(".picker"));
}
