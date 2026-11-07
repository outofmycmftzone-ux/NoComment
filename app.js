const $ = id => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

const STORAGE = "no-comment-settings-v2";

const state = {
  players: [],
  index: 0,
  turn: 1,
  used: {},
  doubleDownUsedThisTurn: false,
  current: null,
  second: null,
  doubleDownInProgress: false,
  doubleSuccess: false,
  extraTurn: false,
  extraCardInProgress: false,
  freeDouble: false,
  nextOverride: null
};

let cards = null;
let rewards = [];
let cardsReady = false;
let rewardsReady = false;

function show(id) {
  screens.forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });
}

function showChoiceModal(title, subtitle, options, cancelText = "CANCEL") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "choice-overlay";

    const panel = document.createElement("div");
    panel.className = "choice-panel";

    const top = document.createElement("div");
    top.className = "choice-top";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const description = document.createElement("p");
    description.textContent = subtitle || "";

    top.append(heading, description);

    const optionList = document.createElement("div");
    optionList.className = "choice-options";

    let finished = false;

    const close = value => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const onKeyDown = event => {
      if (event.key === "Escape") {
        close(null);
      }
    };

    options.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-option";

      const label = document.createElement("strong");
      label.textContent = option.label;
      button.append(label);

      if (option.description) {
        const detail = document.createElement("span");
        detail.textContent = option.description;
        button.append(detail);
      }

      button.onclick = () => close(option.value);
      optionList.append(button);
    });

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "choice-cancel";
    cancel.textContent = cancelText;
    cancel.onclick = () => close(null);

    panel.append(top, optionList, cancel);
    overlay.append(panel);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) close(null);
    });

    document.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);

    const firstOption = optionList.querySelector("button");
    if (firstOption) firstOption.focus();
  });
}

function createPlayer(name) {
  return {
    id: crypto.randomUUID(),
    name,
    reward: null,
    turnsTaken: 0,
    forcedDeck: null,
    pendingExtra: false,
    pendingDouble: false,
    shielded: false
  };
}

function savePlayers() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state.players));
  } catch (error) {
    console.warn("Could not save players.", error);
  }
}

function loadPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));

    if (Array.isArray(saved) && saved.length) {
      state.players = saved.slice(0, 20).map(player => {
        if (typeof player === "string") {
          return createPlayer(player);
        }

        return {
          id: player.id || crypto.randomUUID(),
          name: player.name || "Player",
          reward: null,
          turnsTaken: 0,
          forcedDeck: null,
          pendingExtra: false,
          pendingDouble: false,
          shielded: false
        };
      });
    }
  } catch (error) {
    console.warn("Could not load players.", error);
  }

  if (!state.players.length) {
    state.players = [
      createPlayer("Player 1"),
      createPlayer("Player 2"),
      createPlayer("Player 3"),
      createPlayer("Player 4")
    ];
  }
}

function renderPlayers() {
  $("players").innerHTML = "";

  state.players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "player";

    const input = document.createElement("input");
    input.value = player.name;
    input.maxLength = 24;
    input.setAttribute("aria-label", `Player ${index + 1}`);

    input.addEventListener("change", () => {
      player.name = input.value.trim() || `Player ${index + 1}`;
      input.value = player.name;
      savePlayers();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${player.name}`);

    remove.onclick = () => {
      if (state.players.length <= 2) {
        $("message").textContent = "You need at least two players.";
        return;
      }

      state.players.splice(index, 1);

      if (state.index >= state.players.length) {
        state.index = 0;
      }

      savePlayers();
      renderPlayers();
    };

    row.append(input, remove);
    $("players").append(row);
  });
}

function currentPlayer() {
  return state.players[state.index];
}

function startTurn() {
  const player = currentPlayer();

  if (!player) return;

  player.turnsTaken++;

  if (
    player.reward &&
    player.turnsTaken > player.reward.earnedTurnCount
  ) {
    player.reward.ready = true;
  }

  state.doubleDownUsedThisTurn = false;
}

function renderTurn() {
  if (!state.players.length) {
    show("setup");
    $("message").textContent = "Add at least two players.";
    return;
  }

  const player = currentPlayer();

  $("who").textContent = player.name;
  $("turn").textContent =
    `TURN ${String(state.turn).padStart(2, "0")}`;

  if (player.reward) {
    $("reward-status").textContent = player.reward.ready
      ? `YOUR REWARD: ${player.reward.name}`
      : `REWARD EARNED: ${player.reward.name} · AVAILABLE NEXT TURN`;
  } else {
    $("reward-status").textContent = "";
  }

  document.querySelectorAll("[data-deck]").forEach(button => {
    button.disabled = Boolean(
      player.forcedDeck &&
      button.dataset.deck !== player.forcedDeck
    );
  });
}

function next() {
  if (!state.players.length) {
    show("setup");
    return;
  }

  if (state.extraTurn) {
    state.extraTurn = false;
    state.turn++;
  } else if (state.nextOverride) {
    const targetIndex = state.players.findIndex(
      player => player.id === state.nextOverride
    );

    if (targetIndex !== -1) {
      state.index = targetIndex;
    } else {
      state.index = (state.index + 1) % state.players.length;
    }

    state.nextOverride = null;
    state.turn++;
  } else {
    state.index = (state.index + 1) % state.players.length;
    state.turn++;
  }

  state.current = null;
  state.second = null;
  state.doubleDownInProgress = false;
  state.doubleSuccess = false;
  state.doubleDownUsedThisTurn = false;
  state.extraCardInProgress = false;
  state.freeDouble = false;

  startTurn();
  renderTurn();
  show("game");
}

function pickCard(deck, excludedId = null) {
  const deckCards = cards?.[deck];

  if (!Array.isArray(deckCards) || !deckCards.length) {
    return null;
  }

  state.used[deck] ??= [];

  let available = deckCards.filter(card =>
    !state.used[deck].includes(card.id) &&
    card.id !== excludedId
  );

  if (!available.length) {
    state.used[deck] = [];

    available = deckCards.filter(card =>
      card.id !== excludedId
    );
  }

  if (!available.length) {
    available = deckCards;
  }

  const picked =
    available[Math.floor(Math.random() * available.length)];

  if (picked.id) {
    state.used[deck].push(picked.id);
  }

  return picked;
}

function returnCardToDeck(deck, item) {
  if (!item?.id || !state.used[deck]) return;

  state.used[deck] = state.used[deck].filter(
    id => id !== item.id
  );
}

function getCardText(item) {
  if (typeof item === "string") {
    return item;
  }

  if (item?.levels) {
    return item.levels["1"] ||
      Object.values(item.levels).find(value =>
        typeof value === "string" && value.trim()
      ) ||
      "";
  }

  return item?.text || "";
}

function drawCard(deck) {
  const player = currentPlayer();

  if (player.forcedDeck) {
    deck = player.forcedDeck;
    player.forcedDeck = null;
  }

  const item = pickCard(deck);

  if (!item) {
    $("message").textContent =
      "There are no cards available in this deck.";
    return;
  }

  state.current = {
    deck,
    item,
    text: getCardText(item)
  };

  state.second = null;

  if (!state.doubleDownInProgress) {
    state.doubleSuccess = false;
  }

  renderCard();
  show("card");
}

function renderCard() {
  if (!state.current) return;

  const player = currentPlayer();

  $("category").textContent =
    state.current.deck.toUpperCase();

  $("prompt").textContent = state.second
    ? `${state.current.text}\n\n— AND THEN —\n\n${state.second.text}`
    : state.current.text;

  const hasReward = Boolean(player.reward);

  $("double").hidden =
    state.doubleDownUsedThisTurn || hasReward;

  $("double").disabled =
    state.doubleDownUsedThisTurn || hasReward;

  $("use-reward").hidden = !(
    player.reward &&
    player.reward.ready
  );
}

function drawPunishment() {
  const player = currentPlayer();

  if (player.shielded) {
    player.shielded = false;
    $("penalty").textContent =
      "Your reward protected you. No punishment this time.";
    show("punishment");
    return;
  }

  if (!cards?.punishment?.length) return;

  const list = cards.punishment;
  const index = Math.floor(Math.random() * list.length);

  $("penalty").textContent = list[index];
  show("punishment");
}

function drawRewardChoices() {
  if (!rewardsReady || !rewards.length) {
    $("reward-message").textContent =
      "The reward deck hasn't loaded. Please try again.";
    show("reward-screen");
    return;
  }

  const shuffled = [...rewards].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 2);

  $("reward-options").innerHTML = "";

  choices.forEach(reward => {
    const button = document.createElement("button");
    button.className = "wide secondary";
    button.type = "button";

    const name = document.createElement("strong");
    name.textContent = reward.name;

    const description = document.createElement("p");
    description.textContent = reward.description;

    button.append(name, description);

    button.onclick = () => chooseReward(reward);

    $("reward-options").append(button);
  });

  $("reward-message").textContent = "";
  show("reward-screen");
}

function chooseReward(reward) {
  const player = currentPlayer();

  if (player.reward) {
    $("reward-message").textContent =
      "You already have an unused reward.";
    return;
  }

  player.reward = {
    ...reward,
    earnedTurnCount: player.turnsTaken,
    ready: false
  };

  savePlayers();

  $("reward-options").innerHTML = "";

  $("reward-message").textContent =
    `${player.name} earned ${reward.name}. It will be available on their next turn.`;

  const button = document.createElement("button");
  button.className = "wide";
  button.textContent = "CONTINUE";
  button.onclick = next;

  $("reward-options").append(button);
}

function finishCard() {
  const player = currentPlayer();

  if (player.pendingExtra && !state.extraCardInProgress) {
    player.pendingExtra = false;
    state.extraCardInProgress = true;

    const deck = state.current.deck;
    drawCard(deck);
    return;
  }

  if (state.doubleSuccess && state.second) {
    state.doubleSuccess = false;
    drawRewardChoices();
    return;
  }

  next();
}

async function chooseTarget() {
  const current = currentPlayer();

  const available = state.players
    .filter(player => player.id !== current.id);

  if (!available.length) return null;

  const options = available.map(player => ({
    label: player.name,
    value: player
  }));

  return showChoiceModal(
    "CHOOSE A PLAYER",
    "Who will receive the effect?",
    options
  );
}

async function chooseDeck() {
  const decks = [
    { label: "TRUTH", value: "truth" },
    { label: "DARE", value: "dare" },
    { label: "CONFESSION", value: "confession" },
    { label: "CROSS", value: "cross" }
  ];

  return showChoiceModal(
    "CHOOSE A DECK",
    "Select the deck for this effect.",
    decks
  );
}

function consumeReward() {
  const player = currentPlayer();
  player.reward = null;
  savePlayers();
  renderCard();
  renderTurn();
}

async function activateReward() {
  const player = currentPlayer();
  const reward = player.reward;

  if (!reward || !reward.ready || !state.current) return;

  const action = reward.action;

  if (action === "avoid_punishment") {
    player.shielded = true;
    consumeReward();
    return;
  }

  if (action === "skip_card" || action === "skip_turn") {
    consumeReward();
    next();
    return;
  }

  if (
    action === "redraw_card" ||
    action === "return_card"
  ) {
    const deck = state.current.deck;
    consumeReward();
    drawCard(deck);
    return;
  }

  if (action === "choose_card") {
    const deck = state.current.deck;
    const first = pickCard(deck);
    const second = pickCard(deck, first?.id);

    if (!first || !second) return;

    const chosen = await showChoiceModal(
      "LUCKY DRAW",
      "Choose one card to play.",
      [
        {
          label: "FIRST CARD",
          description: getCardText(first),
          value: "first"
        },
        {
          label: "SECOND CARD",
          description: getCardText(second),
          value: "second"
        }
      ]
    );

    if (!chosen) {
      returnCardToDeck(deck, first);
      returnCardToDeck(deck, second);
      return;
    }

    const selected = chosen === "first" ? first : second;
    const unselected = chosen === "first" ? second : first;

    returnCardToDeck(deck, unselected);

    state.current = {
      deck,
      item: selected,
      text: getCardText(selected)
    };

    state.second = null;
    consumeReward();
    renderCard();
    show("card");
    return;
  }

  if (action === "extra_turn") {
    state.extraTurn = true;
    consumeReward();
    return;
  }

  if (action === "change_deck" || action === "choose_deck") {
    consumeReward();
    state.current = null;
    state.second = null;
    renderTurn();
    show("game");
    $("reward-status").textContent =
      "Choose a new deck for this turn.";
    return;
  }

  if (action === "free_double") {
    if (state.doubleDownUsedThisTurn) return;

    state.doubleDownUsedThisTurn = true;
    state.doubleDownInProgress = true;
    state.freeDouble = true;

    consumeReward();
    show("double-screen");
    return;
  }

  const target = await chooseTarget();

  if (!target) return;

  if (
    action === "extra_card" ||
    action === "encore" ||
    action === "immediate_turn"
  ) {
    target.pendingExtra = true;
  }

  if (
    action === "assign_deck" ||
    action === "force_deck"
  ) {
    const deck = await chooseDeck();
    if (!deck) return;
    target.forcedDeck = deck;
  }

  if (action === "force_cross") {
    target.forcedDeck = "cross";
  }

  if (action === "same_deck") {
    target.forcedDeck = state.current.deck;
  }

  if (action === "forced_choice") {
    target.pendingDouble = true;
  }

  if (
    action === "next_player" ||
    action === "swap_turn"
  ) {
    state.nextOverride = target.id;
  }

  if (action === "immediate_turn") {
    state.nextOverride = target.id;
  }

  consumeReward();
}async function loadCards() {
  cardsReady = false;
  $("begin").disabled = true;
  $("message").textContent = "Loading card library...";

  try {
    const response = await fetch("./cards.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Card library request failed: HTTP ${response.status}`);
    }

    const data = await response.json();

    const requiredDecks = [
      "truth",
      "dare",
      "confession",
      "cross",
      "punishment"
    ];

    for (const deck of requiredDecks) {
      if (!Array.isArray(data[deck]) || !data[deck].length) {
        throw new Error(`Missing or empty deck: ${deck}`);
      }
    }

    for (const deck of ["truth", "dare", "confession", "cross"]) {
      for (let i = 0; i < data[deck].length; i++) {
        const card = data[deck][i];

        if (
          !card ||
          typeof card !== "object" ||
          !card.id ||
          !card.levels ||
          typeof card.levels !== "object"
        ) {
          throw new Error(`${deck} card ${i + 1} has an invalid structure.`);
        }
      }
    }

    cards = data;
    cardsReady = true;

    console.log("NO COMMENT cards loaded successfully.");

    return true;

  } catch (error) {
    cards = null;
    cardsReady = false;

    $("message").textContent =
      `Card loading failed: ${error.message}`;

    console.error("NO COMMENT card loading error:", error);
    return false;
  }
}

async function loadRewards() {
  rewardsReady = false;

  try {
    const response = await fetch("./rewards.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Reward library request failed: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.rewards) || data.rewards.length < 2) {
      throw new Error("The reward deck needs at least two rewards.");
    }

    for (const reward of data.rewards) {
      if (
        !reward.id ||
        !reward.name ||
        !reward.description ||
        !reward.action
      ) {
        throw new Error("A reward is missing required information.");
      }
    }

    rewards = data.rewards;
    rewardsReady = true;

    console.log(`${rewards.length} rewards loaded successfully.`);

    return true;

  } catch (error) {
    rewards = [];
    rewardsReady = false;

    console.error("NO COMMENT reward loading error:", error);
    $("message").textContent =
      `Reward loading failed: ${error.message}`;

    return false;
  }
}

/* NAVIGATION */

$("start").onclick = $("manage").onclick = () => {
  $("message").textContent =
    cardsReady && rewardsReady
      ? ""
      : "Game files are still loading. Please wait.";

  renderPlayers();
  show("setup");
};

$("rules").onclick = () => show("rules-screen");

document.querySelectorAll("[data-go]").forEach(button => {
  button.onclick = () => show(button.dataset.go);
});

/* PLAYER MANAGEMENT */

$("add").onclick = () => {
  const name = $("new-name").value.trim();

  if (!name) return;

  if (state.players.length >= 20) {
    $("message").textContent = "The maximum is 20 players.";
    return;
  }

  state.players.push(createPlayer(name));

  $("new-name").value = "";
  $("message").textContent = "";

  savePlayers();
  renderPlayers();
};

$("new-name").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("add").click();
  }
});

/* START GAME */

$("begin").onclick = () => {
  if (state.players.length < 2) {
    $("message").textContent = "Add at least two players.";
    return;
  }

  if (!cardsReady || !cards || !rewardsReady) {
    $("message").textContent =
      "The game files aren't ready. Please wait and try again.";
    return;
  }

  savePlayers();

  state.index =
    Math.floor(Math.random() * state.players.length);

  state.turn = 1;
  state.used = {};
  state.doubleDownUsedThisTurn = false;
  state.current = null;
  state.second = null;
  state.doubleDownInProgress = false;
  state.doubleSuccess = false;
  state.extraTurn = false;
  state.extraCardInProgress = false;
  state.freeDouble = false;
  state.nextOverride = null;

  state.players.forEach(player => {
    player.reward = null;
    player.turnsTaken = 0;
    player.forcedDeck = null;
    player.pendingExtra = false;
    player.pendingDouble = false;
    player.shielded = false;
  });

  startTurn();

  $("message").textContent = "";

  renderTurn();
  show("game");
};

/* DECK SELECTION */

document.querySelectorAll("[data-deck]").forEach(button => {
  button.onclick = () => {
    if (!cardsReady) return;

    const player = currentPlayer();

    if (
      player.forcedDeck &&
      button.dataset.deck !== player.forcedDeck
    ) {
      return;
    }

    const deck = button.dataset.deck;
    drawCard(deck);

    if (player.pendingDouble && state.current) {
      player.pendingDouble = false;

      const item = pickCard(deck, state.current.item.id);

      if (item) {
        state.second = {
          id: item.id,
          text: getCardText(item)
        };

        renderCard();
      }
    }
  };
});

/* CARD ACTIONS */

$("card-back").onclick = () => show("game");

$("done").onclick = finishCard;

$("no-comment").onclick = drawPunishment;

$("penalty-done").onclick = next;

$("skip").onclick = next;

$("use-reward").onclick = async () => {
  const reward = currentPlayer().reward;

  if (!reward || !reward.ready || !state.current) return;

  const confirmed = await showChoiceModal(
    reward.name,
    reward.description,
    [
      {
        label: "USE THIS REWARD",
        value: true
      }
    ],
    "KEEP REWARD"
  );

  if (confirmed) {
    await activateReward();
  }
};

/* DOUBLE DOWN */

$("double").onclick = () => {
  if (
    !state.current ||
    state.doubleDownUsedThisTurn ||
    currentPlayer().reward
  ) {
    return;
  }

  state.doubleDownUsedThisTurn = true;
  state.doubleDownInProgress = true;
  state.doubleSuccess = false;

  show("double-screen");
};

$("double-back").onclick = () => {
  show("card");
};

/* DRAW A SECOND CARD */

$("double-card").onclick = () => {
  if (!state.current || !state.doubleDownInProgress) return;

  const item = pickCard(
    state.current.deck,
    state.current.item.id
  );

  if (!item) return;

  state.second = {
    id: item.id,
    text: getCardText(item)
  };

  state.doubleSuccess = true;
  state.doubleDownInProgress = false;
  state.freeDouble = false;

  renderCard();
  show("card");
};

/* INITIALIZE */

async function init() {
  loadPlayers();
  renderPlayers();

  const results = await Promise.all([
    loadCards(),
    loadRewards()
  ]);

  if (results.every(Boolean)) {
    $("begin").disabled = false;
    $("message").textContent = "";
  } else {
    $("begin").disabled = true;
  }
}

init();

/* OFFLINE SUPPORT */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(error => console.warn(
        "Service worker registration failed.",
        error
      ));
  });
}