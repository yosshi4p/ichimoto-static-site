const SENTE = "sente";
const GOTE = "gote";
const EMPTY_HAND = () => ({ P: 0, L: 0, N: 0, S: 0, G: 0, B: 0, R: 0 });

const PIECES = {
  K: { jp: "玉", value: 10000 },
  R: { jp: "飛", value: 900 },
  B: { jp: "角", value: 780 },
  G: { jp: "金", value: 540 },
  S: { jp: "銀", value: 500 },
  N: { jp: "桂", value: 360 },
  L: { jp: "香", value: 320 },
  P: { jp: "歩", value: 100 },
  PR: { jp: "龍", value: 1050, promoted: true },
  PB: { jp: "馬", value: 930, promoted: true },
  PS: { jp: "全", value: 560, promoted: true },
  PN: { jp: "圭", value: 540, promoted: true },
  PL: { jp: "杏", value: 520, promoted: true },
  PP: { jp: "と", value: 600, promoted: true },
};

const PROMOTE = { R: "PR", B: "PB", S: "PS", N: "PN", L: "PL", P: "PP" };
const DEMOTE = { PR: "R", PB: "B", PS: "S", PN: "N", PL: "L", PP: "P" };
const HAND_ORDER = ["R", "B", "G", "S", "N", "L", "P"];
const FILES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANKS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const state = {
  board: [],
  hands: { [SENTE]: EMPTY_HAND(), [GOTE]: EMPTY_HAND() },
  turn: SENTE,
  selected: null,
  legalTargets: [],
  pendingPromotion: null,
  history: [],
  locked: false,
};

const els = {
  board: document.querySelector("#board"),
  senteHand: document.querySelector("#senteHand"),
  goteHand: document.querySelector("#goteHand"),
  turnText: document.querySelector("#turnText"),
  scoreText: document.querySelector("#scoreText"),
  scoreBar: document.querySelector("#scoreBar"),
  bestMove: document.querySelector("#bestMove"),
  moveAdvice: document.querySelector("#moveAdvice"),
  cpuPlan: document.querySelector("#cpuPlan"),
  moveList: document.querySelector("#moveList"),
  modal: document.querySelector("#promotionDialog"),
  promoteYes: document.querySelector("#promoteYes"),
  promoteNo: document.querySelector("#promoteNo"),
  newGame: document.querySelector("#newGame"),
};

function freshBoard() {
  const b = Array.from({ length: 9 }, () => Array(9).fill(null));
  const back = ["L", "N", "S", "G", "K", "G", "S", "N", "L"];
  b[0] = back.map((type) => piece(type, GOTE));
  b[1][1] = piece("R", GOTE);
  b[1][7] = piece("B", GOTE);
  b[2] = Array.from({ length: 9 }, () => piece("P", GOTE));
  b[6] = Array.from({ length: 9 }, () => piece("P", SENTE));
  b[7][1] = piece("B", SENTE);
  b[7][7] = piece("R", SENTE);
  b[8] = back.map((type) => piece(type, SENTE));
  return b;
}

function piece(type, owner) {
  return { type, owner };
}

function resetGame() {
  state.board = freshBoard();
  state.hands = { [SENTE]: EMPTY_HAND(), [GOTE]: EMPTY_HAND() };
  state.turn = SENTE;
  state.selected = null;
  state.legalTargets = [];
  state.pendingPromotion = null;
  state.history = [];
  state.locked = false;
  els.moveAdvice.textContent = "初手は飛車先の歩、または角道を開ける手が自然です。中央の駒を働かせる意識で始めましょう。";
  els.cpuPlan.textContent = "CPUは駒得と王手を優先して指します。";
  render();
}

function render() {
  els.board.innerHTML = "";
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const sq = document.createElement("button");
      sq.type = "button";
      sq.className = "square";
      sq.dataset.r = r;
      sq.dataset.c = c;
      sq.setAttribute("role", "gridcell");
      sq.setAttribute("aria-label", `${FILES[c]}${RANKS[r]}`);
      if (state.selected?.kind === "board" && state.selected.r === r && state.selected.c === c) sq.classList.add("selected");
      if (state.legalTargets.some((m) => m.to.r === r && m.to.c === c)) sq.classList.add("legal");
      const p = state.board[r][c];
      if (p) {
        const el = document.createElement("span");
        el.className = `piece ${p.owner} ${PIECES[p.type].promoted ? "promoted" : ""}`;
        el.textContent = PIECES[p.type].jp;
        sq.appendChild(el);
      }
      sq.addEventListener("click", () => onSquare(r, c));
      els.board.appendChild(sq);
    }
  }
  renderHand(SENTE, els.senteHand);
  renderHand(GOTE, els.goteHand);
  const score = evaluate(state.board, state.hands);
  els.scoreText.textContent = scoreLabel(score);
  els.scoreBar.style.width = `${Math.max(8, Math.min(92, 50 + score / 45))}%`;
  const best = bestMoveFor(SENTE);
  els.bestMove.textContent = best ? adviceForCandidate(best) : "合法手がありません。詰み、または王手を受けきれない局面です。";
  els.turnText.textContent = state.locked ? "CPUが考え中" : state.turn === SENTE ? "あなたの番" : "CPUの番";
  renderHistory();
}

function renderHand(owner, target) {
  target.innerHTML = "";
  let hasAny = false;
  for (const type of HAND_ORDER) {
    const count = state.hands[owner][type];
    if (!count) continue;
    hasAny = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hand-piece";
    if (state.selected?.kind === "hand" && state.selected.owner === owner && state.selected.type === type) btn.classList.add("selected");
    btn.innerHTML = `${PIECES[type].jp}<span class="count">x${count}</span>`;
    btn.addEventListener("click", () => onHand(owner, type));
    target.appendChild(btn);
  }
  if (!hasAny) {
    const empty = document.createElement("span");
    empty.className = "label";
    empty.textContent = "なし";
    target.appendChild(empty);
  }
}

function onHand(owner, type) {
  if (state.locked || state.turn !== SENTE || owner !== SENTE) return;
  state.selected = { kind: "hand", owner, type };
  state.legalTargets = legalMoves(SENTE).filter((m) => m.drop && m.type === type);
  render();
}

function onSquare(r, c) {
  if (state.locked || state.turn !== SENTE) return;
  const targetMove = state.legalTargets.find((m) => m.to.r === r && m.to.c === c);
  if (targetMove) {
    choosePromotionIfNeeded(targetMove);
    return;
  }
  const p = state.board[r][c];
  if (p?.owner === SENTE) {
    state.selected = { kind: "board", r, c };
    state.legalTargets = legalMoves(SENTE).filter((m) => !m.drop && m.from.r === r && m.from.c === c);
  } else {
    state.selected = null;
    state.legalTargets = [];
  }
  render();
}

function choosePromotionIfNeeded(move) {
  const p = state.board[move.from?.r]?.[move.from?.c];
  if (!move.drop && p && canPromote(p.type) && inPromotionZone(SENTE, move.from.r, move.to.r)) {
    if (mustPromote(p.type, SENTE, move.to.r)) {
      move.promote = true;
      applyPlayerMove(move);
    } else {
      state.pendingPromotion = move;
      els.modal.classList.remove("hidden");
    }
  } else {
    applyPlayerMove(move);
  }
}

function applyPlayerMove(move) {
  els.modal.classList.add("hidden");
  const before = evaluate(state.board, state.hands);
  const applied = applyMove(state.board, state.hands, move);
  const after = evaluate(state.board, state.hands);
  state.history.push(`▲ ${moveText(applied)}`);
  state.selected = null;
  state.legalTargets = [];
  els.moveAdvice.textContent = commentOnPlayerMove(applied, before, after);
  state.turn = GOTE;
  state.locked = true;
  render();
  window.setTimeout(cpuTurn, 420);
}

function cpuTurn() {
  const move = bestMoveFor(GOTE);
  if (!move) {
    els.cpuPlan.textContent = "CPUに合法手がありません。あなたの勝ちです。";
    state.locked = false;
    state.turn = SENTE;
    render();
    return;
  }
  const applied = applyMove(state.board, state.hands, move);
  state.history.push(`△ ${moveText(applied)}`);
  els.cpuPlan.textContent = commentOnCpuMove(applied);
  state.turn = SENTE;
  state.locked = false;
  render();
}

function legalMoves(owner, board = state.board, hands = state.hands) {
  const moves = pseudoMoves(owner, board, hands);
  return moves.filter((m) => {
    const cloned = cloneBoard(board);
    const clonedHands = cloneHands(hands);
    applyMove(cloned, clonedHands, { ...m });
    return !isInCheck(owner, cloned);
  });
}

function pseudoMoves(owner, board, hands) {
  const moves = [];
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const p = board[r][c];
      if (p?.owner === owner) moves.push(...movesForPiece(r, c, p, board));
    }
  }
  for (const type of HAND_ORDER) {
    if (!hands[owner][type]) continue;
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (canDrop(owner, type, r, c, board)) moves.push({ drop: true, type, owner, to: { r, c } });
      }
    }
  }
  return moves;
}

function movesForPiece(r, c, p, board) {
  const dir = p.owner === SENTE ? -1 : 1;
  const moves = [];
  const addIf = (nr, nc) => {
    if (!inside(nr, nc)) return false;
    const target = board[nr][nc];
    if (target?.owner === p.owner) return false;
    moves.push({ from: { r, c }, to: { r: nr, c: nc }, owner: p.owner });
    return !target;
  };
  const step = (dr, dc) => addIf(r + dr, c + dc);
  const slide = (dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inside(nr, nc)) {
      if (!addIf(nr, nc)) break;
      nr += dr;
      nc += dc;
    }
  };

  if (p.type === "K") [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => step(dr, dc));
  if (["G", "PS", "PN", "PL", "PP"].includes(p.type)) [[dir, -1], [dir, 0], [dir, 1], [0, -1], [0, 1], [-dir, 0]].forEach(([dr, dc]) => step(dr, dc));
  if (p.type === "S") [[dir, -1], [dir, 0], [dir, 1], [-dir, -1], [-dir, 1]].forEach(([dr, dc]) => step(dr, dc));
  if (p.type === "N") [[dir * 2, -1], [dir * 2, 1]].forEach(([dr, dc]) => step(dr, dc));
  if (p.type === "L") slide(dir, 0);
  if (p.type === "P") step(dir, 0);
  if (["R", "PR"].includes(p.type)) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => slide(dr, dc));
  if (["B", "PB"].includes(p.type)) [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => slide(dr, dc));
  if (p.type === "PR") [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => step(dr, dc));
  if (p.type === "PB") [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => step(dr, dc));
  return moves;
}

function canDrop(owner, type, r, c, board) {
  if (board[r][c]) return false;
  if (["P", "L"].includes(type) && (owner === SENTE ? r === 0 : r === 8)) return false;
  if (type === "N" && (owner === SENTE ? r <= 1 : r >= 7)) return false;
  if (type === "P") {
    for (let row = 0; row < 9; row += 1) {
      const p = board[row][c];
      if (p?.owner === owner && p.type === "P") return false;
    }
  }
  return true;
}

function applyMove(board, hands, move) {
  let moving;
  let originalType = move.type;
  let captured = null;
  if (move.drop) {
    moving = piece(move.type, move.owner);
    hands[move.owner][move.type] -= 1;
  } else {
    moving = board[move.from.r][move.from.c];
    originalType = moving.type;
    captured = board[move.to.r][move.to.c];
    board[move.from.r][move.from.c] = null;
    if (captured) hands[move.owner][DEMOTE[captured.type] || captured.type] += 1;
    if (move.promote && PROMOTE[moving.type]) moving = piece(PROMOTE[moving.type], moving.owner);
  }
  board[move.to.r][move.to.c] = moving;
  return { ...move, piece: moving, originalType, captured };
}

function isInCheck(owner, board) {
  let king = null;
  for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) if (board[r][c]?.owner === owner && board[r][c].type === "K") king = { r, c };
  if (!king) return true;
  const enemy = owner === SENTE ? GOTE : SENTE;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const p = board[r][c];
      if (p?.owner === enemy && movesForPiece(r, c, p, board).some((m) => m.to.r === king.r && m.to.c === king.c)) return true;
    }
  }
  return false;
}

function bestMoveFor(owner) {
  const moves = legalMoves(owner);
  if (!moves.length) return null;
  let best = null;
  let bestScore = owner === SENTE ? -Infinity : Infinity;
  for (const raw of moves) {
    const move = { ...raw };
    const p = move.drop ? piece(move.type, owner) : state.board[move.from.r][move.from.c];
    if (!move.drop && canPromote(p.type) && inPromotionZone(owner, move.from.r, move.to.r)) {
      move.promote = shouldPromote(p.type, owner, move.to.r);
    }
    const b = cloneBoard(state.board);
    const h = cloneHands(state.hands);
    const applied = applyMove(b, h, move);
    let score = evaluate(b, h) + tacticalBonus(applied, b, owner);
    if (owner === GOTE) score -= Math.random() * 18;
    if ((owner === SENTE && score > bestScore) || (owner === GOTE && score < bestScore)) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function evaluate(board, hands) {
  let total = 0;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const p = board[r][c];
      if (!p) continue;
      const advance = p.owner === SENTE ? 8 - r : r;
      const positional = p.type !== "K" ? advance * 5 : 0;
      total += (PIECES[p.type].value + positional) * (p.owner === SENTE ? 1 : -1);
    }
  }
  for (const type of HAND_ORDER) {
    total += hands[SENTE][type] * PIECES[type].value * 0.85;
    total -= hands[GOTE][type] * PIECES[type].value * 0.85;
  }
  return Math.round(total);
}

function tacticalBonus(move, board, owner) {
  let bonus = 0;
  if (move.captured) bonus += PIECES[move.captured.type].value * 0.25 * (owner === SENTE ? 1 : -1);
  if (isInCheck(owner === SENTE ? GOTE : SENTE, board)) bonus += 120 * (owner === SENTE ? 1 : -1);
  if (move.promote) bonus += 70 * (owner === SENTE ? 1 : -1);
  return bonus;
}

function commentOnPlayerMove(move, before, after) {
  const delta = after - before;
  const parts = [];
  if (move.captured) parts.push(`${PIECES[move.captured.type].jp}を取れたので駒得です。`);
  if (move.promote) parts.push("成りで駒の働きが強くなりました。");
  if (isInCheck(GOTE, state.board)) parts.push("王手です。CPUは受けを優先します。");
  if (delta > 120) parts.push("評価が良くなっています。この調子で攻めを続けましょう。");
  else if (delta < -120) parts.push("少し評価を落としました。次は取られそうな大駒や玉の安全を確認するとよさそうです。");
  else parts.push("大きな損得はありません。次は駒を前に出して働きを増やす手を探しましょう。");
  const reply = bestMoveFor(GOTE);
  if (reply) parts.push(`CPUは ${moveText(reply)} のような手を狙えます。`);
  return parts.join("");
}

function commentOnCpuMove(move) {
  const parts = [`CPUは ${moveText(move)} と指しました。`];
  if (move.captured) parts.push(`${PIECES[move.captured.type].jp}を取られたので、取り返せるか見てください。`);
  if (isInCheck(SENTE, state.board)) parts.push("あなたの玉に王手がかかっています。まず王手を受けましょう。");
  else parts.push("あなたの番です。おすすめ手を参考に、駒得か王手につながる手を探しましょう。");
  return parts.join("");
}

function adviceForCandidate(move) {
  const text = moveText(move);
  if (move.drop) return `${text} が候補です。持ち駒を盤上に戻して、攻め駒を増やせます。`;
  const p = state.board[move.from.r][move.from.c];
  const target = state.board[move.to.r][move.to.c];
  if (target) return `${text} が候補です。${PIECES[target.type].jp}を取って駒得を狙えます。`;
  if (canPromote(p.type) && inPromotionZone(SENTE, move.from.r, move.to.r)) return `${text} が候補です。成れる位置なので、攻めの力が上がります。`;
  return `${text} が候補です。駒を働かせて、次の攻めや守りを作れます。`;
}

function moveText(move) {
  const dst = `${FILES[move.to.c]}${RANKS[move.to.r]}`;
  if (move.drop) return `${dst}${PIECES[move.type].jp}打`;
  const src = `(${9 - move.from.c}${move.from.r + 1})`;
  const type = move.originalType || move.piece?.type || state.board[move.from.r][move.from.c]?.type || "P";
  return `${dst}${PIECES[type].jp}${move.promote ? "成" : ""}${src}`;
}

function renderHistory() {
  els.moveList.innerHTML = "";
  state.history.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m;
    els.moveList.appendChild(li);
  });
}

function scoreLabel(score) {
  if (score > 650) return "あなた優勢";
  if (score > 180) return "あなたやや良し";
  if (score < -650) return "CPU優勢";
  if (score < -180) return "CPUやや良し";
  return "互角";
}

function inside(r, c) {
  return r >= 0 && r < 9 && c >= 0 && c < 9;
}

function canPromote(type) {
  return Boolean(PROMOTE[type]);
}

function inPromotionZone(owner, fromR, toR) {
  return owner === SENTE ? fromR <= 2 || toR <= 2 : fromR >= 6 || toR >= 6;
}

function mustPromote(type, owner, row) {
  if (["P", "L"].includes(type)) return owner === SENTE ? row === 0 : row === 8;
  if (type === "N") return owner === SENTE ? row <= 1 : row >= 7;
  return false;
}

function shouldPromote(type, owner, row) {
  return mustPromote(type, owner, row) || ["R", "B", "P"].includes(type);
}

function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function cloneHands(hands) {
  return { [SENTE]: { ...hands[SENTE] }, [GOTE]: { ...hands[GOTE] } };
}

els.promoteYes.addEventListener("click", () => {
  state.pendingPromotion.promote = true;
  applyPlayerMove(state.pendingPromotion);
  state.pendingPromotion = null;
});

els.promoteNo.addEventListener("click", () => {
  state.pendingPromotion.promote = false;
  applyPlayerMove(state.pendingPromotion);
  state.pendingPromotion = null;
});

els.newGame.addEventListener("click", resetGame);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));
    document.querySelector(`#${tab.dataset.tab}Pane`).classList.add("active");
  });
});

resetGame();
