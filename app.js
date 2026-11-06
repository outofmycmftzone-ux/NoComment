
const $ = id => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

const STORAGE = "no-comment-settings-v2";

const state = {
  players: [],
  index: 0,
  turn: 1,
  used: {},
  tokens: new Set(),
  current: null,
  second: null
};

let cards = null;

function show(id) {
  screens.forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });
}

function createPlayer(name) {
  return {
    id: crypto.randomUUID(),
    name: name
  };
}

function savePlayers() {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify(state.players)
    );
  } catch (error) {
    console.warn("Could not save players.", error);
  }
}

function loadPlayers() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE)
    );

    if (Array.isArray(saved) && saved.length) {
      state.players = saved.slice(0, 20).map(player => {
        if (typeof player === "string") {
          return createPlayer(player);
        }

        return {
          id: player.id || crypto.randomUUID(),
          name: player.name || "Player"
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
    input.setAttribute(
      "aria-label",
      `Player ${index + 1}`
    );

    input.addEventListener("change", () => {
      player.name = input.value.trim() || `Player ${index + 1}`;
      input.value = player.name;
      savePlayers();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      `Remove ${player.name}`
    );

    remove.onclick = () => {
      if (state.players.length <= 2) {
        $("message").textContent =
          "You need at least two players.";
        return;
      }

      state.players.splice(index, 1);
      savePlayers();
      renderPlayers();
    };

    row.append(input, remove);
    $("players").append(row);
  });
}

function renderTurn() {
  if (!state.players.length) {
    show("setup");
    $("message").textContent = "Add at least two players.";
    return;
  }

  $("who").textContent = state.players[state.index].name;

  $("turn").textContent =
    `TURN ${String(state.turn).padStart(2, "0")}`;

  $("tokens").textContent =
    state.players.length - state.tokens.size;
}

function next() {
  if (!state.players.length) {
    show("setup");
    return;
  }

  state.index = (state.index + 1) % state.players.length;
  state.turn++;

  state.current = null;
  state.second = null;

  renderTurn();
  show("game");
}

function pickCard(deck, excludedId = null) {
  const deckCards = cards[deck];

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

  state.used[deck].push(picked.id);

  return picked;
}

function getCardText(item) {
  if (typeof item === "string") {
    return item;
  }

  if (item.levels) {
    return item.levels["1"] ||
      Object.values(item.levels)[0] ||
      "";
  }

  return item.text || "";
}

function drawCard(deck) {
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

  renderCard();
  show("card");
}

function renderCard() {
  if (!state.current) return;

  const current = state.current;

  $("category").textContent =
    current.deck.toUpperCase();

  $("intensity").hidden = true;

  $("prompt").textContent = state.second
    ? `${current.text}\n\n— AND THEN —\n\n${state.second.text}`
    : current.text;

  const tokenUsed =
    state.tokens.has(state.players[state.index].id);

  $("double").hidden = tokenUsed;
  $("double").disabled = tokenUsed;
}

function spendToken() {
  const player = state.players[state.index];

  if (!player || state.tokens.has(player.id)) {
    return false;
  }

  state.tokens.add(player.id);
  renderTurn();

  return true;
}

function drawPunishment() {
  if (!cards || !cards.punishment?.length) return;

  const list = cards.punishment;

  const index = Math.floor(Math.random() * list.length);

  $("penalty").textContent = list[index];

  show("punishment");
}

async function loadCards() {
  try {
    const response = await fetch("./cards.json");

    if (!response.ok) {
      throw new Error("Card library unavailable.");
    }

    cards = await response.json();

    const requiredDecks = [
      "truth",
      "dare",
      "confession",
      "cross",
      "punishment"
    ];

    for (const deck of requiredDecks) {
      if (!Array.isArray(cards[deck]) || !cards[deck].length) {
        throw new Error(`Missing or empty deck: ${deck}`);
      }
    }

    return true;

  } catch (error) {
    console.error(error);

    $("message").textContent =
      "The card library couldn't load. Connect to the internet and reload.";

    return false;
  }
}

/* NAVIGATION */

$("start").onclick = $("manage").onclick = () => {
  $("message").textContent = "";
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
    $("message").textContent =
      "The maximum is 20 players.";
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
    $("message").textContent =
      "Add at least two players.";
    return;
  }

  if (!cards) {
    $("message").textContent =
      "The cards haven't loaded yet. Please try again.";
    return;
  }

  savePlayers();

  state.index =
    Math.floor(Math.random() * state.players.length);

  state.turn = 1;
  state.used = {};
  state.tokens.clear();
  state.current = null;
  state.second = null;

  $("message").textContent = "";

  renderTurn();
  show("game");
};

/* DECK SELECTION */

document.querySelectorAll("[data-deck]").forEach(button => {
  button.onclick = () => {
    if (!cards) return;

    drawCard(button.dataset.deck);
  };
});

/* CARD ACTIONS */

$("card-back").onclick = () => show("game");

$("done").onclick = next;

$("no-comment").onclick = drawPunishment;

$("penalty-done").onclick = next;

$("skip").onclick = next;

/* DOUBLE DOWN */

$("double-intensity").hidden = true;

$("double").onclick = () => {
  if (!state.current) return;

  if (!spendToken()) return;

  show("double-screen");
};

$("double-back").onclick = () => show("card");

/* DRAW A SECOND CARD */

$("double-card").onclick = () => {
  if (!state.current) return;

  const item = pickCard(
    state.current.deck,
    state.current.item.id
  );

  if (!item) return;

  state.second = {
    id: item.id,
    text: getCardText(item)
  };

  renderCard();
  show("card");
};

/* INITIALIZE */

async function init() {
  loadPlayers();
  renderPlayers();

  await loadCards();
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
