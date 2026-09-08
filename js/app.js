// js/app.js

const socket = io();
const roomCode = "witherbloom-table-1";
let myPlayerSlot = 1;
let isMyTurn = true;
let myNickname = "Player";

// DOM Yüklendiğinde Giriş Ekranı ve Buton Dinleyicilerini Kurma
document.addEventListener('DOMContentLoaded', () => {
  const welcomeModal = document.getElementById('welcome-modal');
  const joinBtn = document.getElementById('join-table-btn');
  const nicknameInput = document.getElementById('player-nickname-input');
  const decklistInput = document.getElementById('decklist-input');

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const nameVal = nicknameInput.value.trim();
      if (nameVal) myNickname = nameVal;

      const rawDeckText = decklistInput ? decklistInput.value : "";
      const customDeck = parseCustomDecklist(rawDeckText);

      welcomeModal.style.display = 'none';

      socket.emit('join-room', { roomCode, username: myNickname });

      initGameWithCustom(customDeck);
    });
  }

  const gravePile = document.getElementById('graveyard-pile');
  if (gravePile) gravePile.addEventListener('click', () => openPileModal('Graveyard', graveyard));

  const exilePile = document.getElementById('exile-pile');
  if (exilePile) exilePile.addEventListener('click', () => openPileModal('Exile', exile));

  const closePileBtn = document.getElementById('close-pile-modal');
  if (closePileBtn) closePileBtn.addEventListener('click', () => { pileModal.style.display = 'none'; });

  document.getElementById('close-library-modal').addEventListener('click', () => { libraryModal.style.display = 'none'; });
  document.getElementById('close-tutor-target').addEventListener('click', () => { tutorTargetModal.style.display = 'none'; });
  document.getElementById('search-lib-btn').addEventListener('click', openLibraryModal);

  librarySearchInput.addEventListener('input', filterLibraryCards);
  libraryTypeFilter.addEventListener('change', filterLibraryCards);

  const endTurnBtn = document.getElementById('end-turn-btn');
  if (endTurnBtn) endTurnBtn.addEventListener('click', endTurn);

  document.querySelectorAll('.mana-box').forEach(box => {
    const colorKey = box.querySelector('.mana-label').innerText;
    box.addEventListener('click', (e) => { e.preventDefault(); addMana(colorKey, 1); });
    box.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (manaPool[colorKey] > 0) { manaPool[colorKey]--; updateManaPoolUI(); }
    });
  });

  document.querySelectorAll('.phase-step').forEach(step => {
    step.addEventListener('click', (e) => {
      document.querySelectorAll('.phase-step').forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      if (e.target.innerText === 'UNTAP') clearManaPool();
    });
  });

  document.getElementById('tutor-to-hand').addEventListener('click', () => {
    if (!selectedTutorCard) return;
    deck = deck.filter(c => c.instanceId !== selectedTutorCard.instanceId);
    hand.push(selectedTutorCard);
    finalizeTutor();
  });

  document.getElementById('tutor-to-field').addEventListener('click', () => {
    if (!selectedTutorCard) return;
    deck = deck.filter(c => c.instanceId !== selectedTutorCard.instanceId);
    const typeStr = (selectedTutorCard.type || "").toLowerCase();
    selectedTutorCard.isTapped = false;
    selectedTutorCard.isFacedDown = false;
    if (typeStr.includes('creature')) boardState.creatures.push(selectedTutorCard);
    else if (typeStr.includes('land')) boardState.lands.push(selectedTutorCard);
    else boardState.noncreatures.push(selectedTutorCard);
    finalizeTutor();
  });

  document.getElementById('tutor-to-top').addEventListener('click', () => {
    if (!selectedTutorCard) return;
    deck = deck.filter(c => c.instanceId !== selectedTutorCard.instanceId);
    deck.push(selectedTutorCard);
    finalizeTutor();
  });

  const untapBtn = document.getElementById('untap-all-btn');
  if (untapBtn) untapBtn.addEventListener('click', untapAllCards);

  const lifeUp = document.getElementById('my-life-up');
  const lifeDown = document.getElementById('my-life-down');
  const lifeDisplay = document.getElementById('my-life');

  if (lifeUp) lifeUp.addEventListener('click', () => {
    myLife++;
    if (lifeDisplay) lifeDisplay.innerText = myLife;
    socket.emit('board-update', { roomCode, type: 'life-change', life: myLife });
  });

  if (lifeDown) lifeDown.addEventListener('click', () => {
    myLife--;
    if (lifeDisplay) lifeDisplay.innerText = myLife;
    socket.emit('board-update', { roomCode, type: 'life-change', life: myLife });
  });

  document.querySelectorAll('.opp-life-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const change = parseInt(e.target.dataset.change);
      const valSpan = e.target.parentElement.querySelector('.life-val');
      valSpan.innerText = parseInt(valSpan.innerText) + change;
    });
  });

  const deckPile = document.getElementById('deck-pile');
  if (deckPile) deckPile.addEventListener('click', drawCard);

  const drawBtn = document.getElementById('draw-btn');
  if (drawBtn) drawBtn.addEventListener('click', drawCard);

  const shuffleBtn = document.getElementById('shuffle-btn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => { shuffle(deck); alert("Library shuffled!"); });
});

// Güncellenmiş Sayaç (+3/+3 formatlı) Üretme ve Yönetme Fonksiyonu
function spawnCounter(type) {
  const arenaFrame = document.getElementById('arena-frame');
  if (!arenaFrame) return;

  const counter = document.createElement('div');
  counter.classList.add('game-counter');
  
  let counterValue = 1;
  const isMinus = type.includes('-');
  if (isMinus) {
    counter.classList.add('minus');
  }

  counter.style.left = `50%`;
  counter.style.top = `40%`;

  updateCounterDisplay();

  // Sol tık: Değeri 1 artırır (+1/+1 -> +2/+2 -> +3/+3)
  counter.addEventListener('click', (e) => {
    e.stopPropagation();
    counterValue++;
    updateCounterDisplay();
  });

  // Sağ tık: Değeri 1 azaltır, 0 veya altına inerse sayacı siler
  counter.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    counterValue--;
    if (counterValue <= 0) {
      counter.remove();
    } else {
      updateCounterDisplay();
    }
  });

  // Çift tık: Direkt sayı girmeyi sağlar (örn: 5 yazıldığında +5/+5 olur)
  counter.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const inputVal = prompt("Enter counter value (e.g. 5):", counterValue);
    if (inputVal !== null) {
      const parsed = parseInt(inputVal);
      if (!isNaN(parsed) && parsed > 0) {
        counterValue = parsed;
        updateCounterDisplay();
      } else if (parsed <= 0) {
        counter.remove();
      }
    }
  });

  function updateCounterDisplay() {
    if (isMinus) {
      counter.innerText = `-${counterValue}/-${counterValue}`;
    } else {
      counter.innerText = `+${counterValue}/+${counterValue}`;
    }
  }

  let isDragging = false;
  let offsetX, offsetY;

  counter.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      counter.classList.add('dragging');
      offsetX = e.clientX - counter.offsetLeft;
      offsetY = e.clientY - counter.offsetTop;
      e.stopPropagation();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    counter.style.left = `${e.clientX - offsetX}px`;
    counter.style.top = `${e.clientY - offsetY}px`;
    counter.style.position = 'fixed';
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      counter.classList.remove('dragging');
    }
  });

  arenaFrame.appendChild(counter);
}

// Deste Ayrıştırma (Parser) Fonksiyonu
function parseCustomDecklist(text) {
  const lines = text.split('\n');
  const cards = [];
  let commander = null;
  let isFirstCard = true;

  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    let cleanLine = line
      .replace(/^\d+\s+/, '')
      .replace(/\s*\([A-Za-z0-9]+\).*$/, '')
      .replace(/\s*\*F\*/g, '')
      .trim();

    if (!cleanLine) return;

    const countMatch = line.match(/^(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;

    if (isFirstCard) {
      commander = { name: cleanLine, type: "Legendary Creature — Commander" };
      isFirstCard = false;
    } else {
      cards.push({ name: cleanLine, type: "Card", count: count });
    }
  });

  return { commander, cards };
}

// Socket Dinleyicileri
socket.on('init-room-state', (data) => {
  myPlayerSlot = data.slot;
  isMyTurn = data.isMyTurn;
  updateTurnUI();
});

socket.on('update-players', (players) => {
  const oppSlots = ['board-opp1', 'board-opp2', 'board-opp3'];
  oppSlots.forEach(id => {
    const titleSpan = document.querySelector(`#${id} .player-title span`);
    if (titleSpan) titleSpan.innerText = "WAITING FOR PLAYER...";
  });

  let oppIndex = 0;
  players.forEach(p => {
    if (p.id !== socket.id) {
      if (oppIndex < oppSlots.length) {
        const targetOppId = oppSlots[oppIndex];
        const oppTitle = document.querySelector(`#${targetOppId} .player-title span`);
        if (oppTitle) {
          oppTitle.innerText = p.username;
        }
        oppIndex++;
      }
    }
  });
});

socket.on('sync-board', (data) => {
  if (data.type === 'board-state') {
    if (data.boardState && data.boardState.creatures) {
      opponentBoards['board-opp1'].creatures = data.boardState.creatures;
      opponentBoards['board-opp1'].noncreatures = data.boardState.noncreatures;
      opponentBoards['board-opp1'].lands = data.boardState.lands;
      renderAllOpponents();
    }
  } else if (data.type === 'life-change') {
    const oppLifeVal = document.querySelector('#board-opp1 .life-val');
    if (oppLifeVal) oppLifeVal.innerText = data.life;
  }
});

socket.on('sync-turn', (data) => {
  isMyTurn = true;
  updateTurnUI();
  clearManaPool();
});

function endTurn() {
  if (!isMyTurn) return;
  isMyTurn = false;
  updateTurnUI();
  socket.emit('end-turn', { roomCode });
}

function updateTurnUI() {
  const statusText = document.getElementById('turn-status-text');
  const endTurnBtn = document.getElementById('end-turn-btn');
  
  if (statusText && endTurnBtn) {
    if (isMyTurn) {
      statusText.innerText = "YOUR TURN";
      statusText.style.color = "#ffd700";
      endTurnBtn.disabled = false;
      endTurnBtn.style.opacity = "1";
    } else {
      statusText.innerText = "OPPONENT'S TURN";
      statusText.style.color = "#888";
      endTurnBtn.disabled = true;
      endTurnBtn.style.opacity = "0.5";
    }
  }
}

let deck = [];
let hand = [];
let commander = null;
let boardState = { creatures: [], noncreatures: [], lands: [] };

let opponentBoards = {
  'board-opp1': { creatures: [], noncreatures: [], lands: [] },
  'board-opp2': { creatures: [], noncreatures: [], lands: [] },
  'board-opp3': { creatures: [], noncreatures: [], lands: [] }
};

let graveyard = [];
let exile = [];
let myLife = 40;
let activeZoomBoardId = null;
let selectedTutorCard = null;

let manaPool = { C: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
let isZPressed = false;
let currentHoveredCardImgSrc = null;

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'z') {
    isZPressed = true;
    if (currentHoveredCardImgSrc) showTtsPopup(currentHoveredCardImgSrc);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'z') {
    isZPressed = false;
    hideTtsPopup();
  }
});

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function initGameWithCustom(deckConfig) {
  const commanderCard = deckConfig.commander;
  const deckList = deckConfig.cards;
  
  deck = [];
  hand = [];
  boardState = { creatures: [], noncreatures: [], lands: [] };
  
  Object.keys(opponentBoards).forEach(oppId => {
    opponentBoards[oppId] = { creatures: [], noncreatures: [], lands: [] };
  });

  graveyard = [];
  exile = [];
  clearManaPool();

  commander = { 
    ...commanderCard, 
    instanceId: "commander-card-id", 
    isTapped: false, 
    isFacedDown: false 
  };

  deckList.forEach(card => {
    for (let i = 0; i < card.count; i++) {
      deck.push({ 
        name: card.name,
        type: card.type,
        instanceId: Math.random().toString(36).substr(2, 9),
        isTapped: false,
        isFacedDown: false 
      });
    }
  });

  shuffle(deck);

  for (let i = 0; i < 7; i++) {
    if (deck.length > 0) hand.push(deck.pop());
  }

  renderCommander();
  renderHand();
  renderBoard();
  renderAllOpponents();
  updatePilesUI();
  setupDropZones();
}

function updateManaPoolUI() {
  ['c', 'w', 'u', 'b', 'r', 'g'].forEach(color => {
    const el = document.getElementById(`mana-${color}`);
    if (el) el.innerText = manaPool[color.toUpperCase()];
  });
}

function addMana(color, amount = 1) {
  const key = color.toUpperCase();
  if (manaPool[key] !== undefined) {
    manaPool[key] += amount;
    updateManaPoolUI();
  }
}

function clearManaPool() {
  manaPool = { C: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
  updateManaPoolUI();
}

function getLandManaType(cardName) {
  const name = (cardName || "").toLowerCase();
  if (name.includes("forest")) return "G";
  if (name.includes("swamp")) return "B";
  if (name.includes("island")) return "U";
  if (name.includes("plains")) return "W";
  if (name.includes("mountain")) return "R";
  return "G";
}

function toggleTapCard(card, element, isLandZone = false) {
  card.isTapped = !card.isTapped;
  if (card.isTapped) {
    element.classList.add('tapped');
    if (isLandZone) {
      const manaType = getLandManaType(card.name);
      addMana(manaType, 1);
    }
  } else {
    element.classList.remove('tapped');
  }
}

function showTtsPopup(imgSrc) {
  const popup = document.getElementById('tts-popup-modal');
  const popupImg = document.getElementById('tts-popup-img');
  if (popup && popupImg) {
    popupImg.src = imgSrc;
    popup.style.display = 'flex';
  }
}

function hideTtsPopup() {
  const popup = document.getElementById('tts-popup-modal');
  if (popup) popup.style.display = 'none';
}

function createCardElement(card, isOnBoard = false, isLandZone = false) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('card-wrapper');
  if (card.isTapped) wrapper.classList.add('tapped');
  
  wrapper.draggable = true;
  wrapper.dataset.instanceId = card.instanceId;

  wrapper.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', card.instanceId);
    wrapper.classList.add('dragging');
  });

  wrapper.addEventListener('dragend', () => {
    wrapper.classList.remove('dragging');
  });

  const img = document.createElement('img');
  img.classList.add('card-image');
  
  if (card.isFacedDown) {
    img.src = 'https://cards.scryfall.io/back.png';
  } else {
    const cleanName = (card.name || "Forest").split('//')[0].trim();
    img.src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cleanName)}&format=image`;
  }

  img.alt = card.isFacedDown ? 'Faced Down Card' : (card.name || 'MTG Card');
  img.onerror = () => { img.onerror = null; img.src = 'https://cards.scryfall.io/back.png'; };

  wrapper.appendChild(img);

  if (isOnBoard) {
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTapCard(card, wrapper, isLandZone);
    });

    wrapper.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      card.isFacedDown = !card.isFacedDown;
      if (activeZoomBoardId) renderInspectedBoard(activeZoomBoardId);
      else renderBoard();
      renderAllOpponents();
    });
  }

  wrapper.addEventListener('mouseenter', () => {
    if (!card.isFacedDown) {
      currentHoveredCardImgSrc = img.src;
      if (isZPressed) showTtsPopup(img.src);
    }
  });

  wrapper.addEventListener('mouseleave', () => {
    if (currentHoveredCardImgSrc === img.src) currentHoveredCardImgSrc = null;
    hideTtsPopup();
  });

  return wrapper;
}

function setupDropZones() {
  const dropZones = [
    document.getElementById('graveyard-pile'),
    document.getElementById('exile-pile'),
    document.getElementById('command-zone'),
    document.getElementById('creature-zone'),
    document.getElementById('noncreature-zone'),
    document.getElementById('land-zone'),
    document.getElementById('player-hand')
  ];

  dropZones.forEach(zone => {
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const instanceId = e.dataTransfer.getData('text/plain');
      if (!instanceId) return;
      handleCardDrop(instanceId, zone.id);
    });
  });
}

function handleCardDrop(instanceId, targetZoneId) {
  const isFieldZone = ['creature-zone', 'noncreature-zone', 'land-zone'].includes(targetZoneId);
  let foundCard = null;

  const handIndex = hand.findIndex(c => c.instanceId === instanceId);
  if (handIndex !== -1) foundCard = hand.splice(handIndex, 1)[0];

  if (!foundCard && commander && commander.instanceId === instanceId) {
    if (targetZoneId !== 'command-zone') {
      foundCard = commander;
      commander = null;
      renderCommander();
    }
  }

  if (!foundCard) {
    const activeState = activeZoomBoardId ? opponentBoards[activeZoomBoardId] : boardState;
    for (const zoneName of ['creatures', 'noncreatures', 'lands']) {
      const idx = activeState[zoneName].findIndex(c => c.instanceId === instanceId);
      if (idx !== -1) { foundCard = activeState[zoneName].splice(idx, 1)[0]; break; }
    }
  }

  if (!foundCard) {
    const graveIdx = graveyard.findIndex(c => c.instanceId === instanceId);
    if (graveIdx !== -1) foundCard = graveyard.splice(graveIdx, 1)[0];
    else {
      const exileIdx = exile.findIndex(c => c.instanceId === instanceId);
      if (exileIdx !== -1) foundCard = exile.splice(exileIdx, 1)[0];
    }
  }

  if (!foundCard) {
    const deckIdx = deck.findIndex(c => c.instanceId === instanceId);
    if (deckIdx !== -1) foundCard = deck.splice(deckIdx, 1)[0];
  }

  if (!foundCard) return;

  if (activeZoomBoardId && isFieldZone) {
    foundCard.isTapped = false;
    foundCard.isFacedDown = false;
    hand.push(foundCard);
    renderHand();
    if (activeZoomBoardId) renderInspectedBoard(activeZoomBoardId);
    else renderBoard();
    renderAllOpponents();
    updatePilesUI();
    return;
  }

  const targetState = activeZoomBoardId ? opponentBoards[activeZoomBoardId] : boardState;

  if (targetZoneId === 'graveyard-pile') {
    foundCard.isTapped = false; foundCard.isFacedDown = false; graveyard.push(foundCard);
  } else if (targetZoneId === 'exile-pile') {
    foundCard.isTapped = false; foundCard.isFacedDown = false; exile.push(foundCard);
  } else if (targetZoneId === 'command-zone') {
    foundCard.isTapped = false; foundCard.isFacedDown = false; commander = foundCard; renderCommander();
  } else if (isFieldZone) {
    const typeStr = (foundCard.type || "").toLowerCase();
    foundCard.isTapped = false; foundCard.isFacedDown = false;
    if (typeStr.includes('creature')) targetState.creatures.push(foundCard);
    else if (typeStr.includes('land')) targetState.lands.push(foundCard);
    else targetState.noncreatures.push(foundCard);
  } else if (targetZoneId === 'player-hand') {
    foundCard.isTapped = false; foundCard.isFacedDown = false; hand.push(foundCard);
  }

  renderHand();
  if (activeZoomBoardId) renderInspectedBoard(activeZoomBoardId);
  else renderBoard();
  renderAllOpponents();
  updatePilesUI();

  socket.emit('board-update', { roomCode, type: 'board-state', boardState });
}

function untapAllCards() {
  const activeState = activeZoomBoardId ? opponentBoards[activeZoomBoardId] : boardState;
  Object.keys(activeState).forEach(zone => {
    activeState[zone].forEach(card => { card.isTapped = false; });
  });
  document.querySelectorAll('.field-zone .card-wrapper.tapped').forEach(el => el.classList.remove('tapped'));
}

function renderCommander() {
  const slot = document.getElementById('commander-card-slot');
  if (!slot) return;
  slot.innerHTML = '<span style="font-size:0.7em; position:absolute; top:2px; left:4px; color:#ffd700; z-index:5;">COMMAND</span>';
  if (commander) slot.appendChild(createCardElement(commander, false));
}

function drawCard() {
  if (deck.length === 0) return alert("No cards left in library!");
  hand.push(deck.pop());
  updatePilesUI();
  renderHand();
}

function renderHand() {
  const handContainer = document.getElementById('player-hand');
  if (!handContainer) return;
  handContainer.innerHTML = '';
  const totalCards = hand.length;
  const maxAngle = 5;

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card, false);
    if (totalCards > 1) {
      const angle = -maxAngle + (index / (totalCards - 1)) * (maxAngle * 2);
      const translateY = Math.abs(angle) * 1.8;
      cardEl.style.transform = `rotate(${angle}deg) translateY(${translateY}px)`;
    }
    handContainer.appendChild(cardEl);
  });
}

function renderBoard() {
  renderZone('creature-zone', boardState.creatures, 'Creatures', false);
  renderZone('noncreature-zone', boardState.noncreatures, 'Artifacts & Enchantments', false);
  renderZone('land-zone', boardState.lands, 'Lands', true);
}

function renderZone(elementId, cardArray, label, isLandZone = false) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = `<span class="zone-label">${label}</span>`;
  cardArray.forEach(card => container.appendChild(createCardElement(card, true, isLandZone)));
}

function renderAllOpponents() {
  Object.keys(opponentBoards).forEach(oppId => {
    const boardEl = document.getElementById(oppId);
    if (!boardEl) return;
    const miniZones = boardEl.querySelectorAll('.opp-zone');
    if (miniZones.length >= 3) {
      renderMiniZone(miniZones[0], opponentBoards[oppId].creatures);
      renderMiniZone(miniZones[1], opponentBoards[oppId].noncreatures);
      renderMiniZone(miniZones[2], opponentBoards[oppId].lands);
    }
  });

  if (activeZoomBoardId) {
    const activeBoardEl = document.getElementById(activeZoomBoardId);
    if (activeBoardEl) {
      const miniZones = activeBoardEl.querySelectorAll('.opp-zone');
      if (miniZones.length >= 3) {
        renderMiniZone(miniZones[0], boardState.creatures);
        renderMiniZone(miniZones[1], boardState.noncreatures);
        renderMiniZone(miniZones[2], boardState.lands);
      }
    }
  }
}

function renderMiniZone(zoneEl, cardArray) {
  const labelEl = zoneEl.querySelector('.opp-zone-label');
  zoneEl.innerHTML = '';
  if (labelEl) zoneEl.appendChild(labelEl);

  cardArray.forEach(card => {
    const miniCard = document.createElement('div');
    miniCard.classList.add('card-wrapper');
    if (card.isTapped) miniCard.classList.add('tapped');
    const img = document.createElement('img');
    img.classList.add('card-image');
    img.src = card.isFacedDown ? 'https://cards.scryfall.io/back.png' : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent((card.name || "Forest").split('//')[0].trim())}&format=image`;
    miniCard.appendChild(img);
    zoneEl.appendChild(miniCard);
  });
}

function renderInspectedBoard(oppId) {
  const oppState = opponentBoards[oppId];
  renderZone('creature-zone', oppState.creatures, 'Inspected Creatures', false);
  renderZone('noncreature-zone', oppState.noncreatures, 'Inspected Artifacts & Enchantments', false);
  renderZone('land-zone', oppState.lands, 'Inspected Lands', false);
}

function toggleZoom(targetBoardId) {
  const targetBoard = document.getElementById(targetBoardId);
  if (activeZoomBoardId === targetBoardId) { resetBoardLayout(); return; }
  if (activeZoomBoardId) resetBoardLayout();

  activeZoomBoardId = targetBoardId;
  targetBoard.classList.add('swapped-board');
  const zoomBtn = targetBoard.querySelector('.zoom-btn');
  if (zoomBtn) zoomBtn.classList.add('active');

  const playerTitleSpan = targetBoard.querySelector('.player-title span');
  if (playerTitleSpan) {
    targetBoard.dataset.originalName = playerTitleSpan.innerText;
    playerTitleSpan.innerText = 'INSPECTING...';
  }

  renderInspectedBoard(targetBoardId);
  renderAllOpponents();
}

function resetBoardLayout() {
  if (!activeZoomBoardId) return;
  const targetBoard = document.getElementById(activeZoomBoardId);
  targetBoard.classList.remove('swapped-board');
  const zoomBtn = targetBoard.querySelector('.zoom-btn');
  if (zoomBtn) zoomBtn.classList.remove('active');

  const playerTitleSpan = targetBoard.querySelector('.player-title span');
  if (playerTitleSpan && targetBoard.dataset.originalName) playerTitleSpan.innerText = targetBoard.dataset.originalName;

  activeZoomBoardId = null;
  renderBoard();
  renderAllOpponents();
}

const libraryModal = document.getElementById('library-modal');
const libraryCardsContainer = document.getElementById('library-modal-cards');
const librarySearchInput = document.getElementById('library-search-input');
const libraryTypeFilter = document.getElementById('library-type-filter');
const tutorTargetModal = document.getElementById('tutor-target-modal');

function openLibraryModal() {
  librarySearchInput.value = '';
  libraryTypeFilter.value = 'all';
  renderLibraryGrid(deck);
  libraryModal.style.display = 'flex';
}

function filterLibraryCards() {
  const term = librarySearchInput.value.toLowerCase();
  const selectedType = libraryTypeFilter.value;
  const filtered = deck.filter(card => {
    const matchesName = card.name.toLowerCase().includes(term);
    const cardType = (card.type || "").toLowerCase();
    const matchesType = (selectedType === 'all') || cardType.includes(selectedType);
    return matchesName && matchesType;
  });
  renderLibraryGrid(filtered);
}

function renderLibraryGrid(cardsArray) {
  libraryCardsContainer.innerHTML = '';
  cardsArray.forEach(card => {
    const cardEl = createCardElement(card, false);
    cardEl.title = "Click to select card";
    cardEl.addEventListener('click', () => {
      selectedTutorCard = card;
      libraryModal.style.display = 'none';
      tutorTargetModal.style.display = 'flex';
    });
    libraryCardsContainer.appendChild(cardEl);
  });
}

const pileModal = document.getElementById('pile-modal');
const pileCardsContainer = document.getElementById('pile-modal-cards');

function finalizeTutor() {
  tutorTargetModal.style.display = 'none';
  selectedTutorCard = null;
  librarySearchInput.value = '';
  libraryTypeFilter.value = 'all';
  renderHand();
  renderBoard();
  updatePilesUI();
  shuffle(deck);
}

function openPileModal(title, array) {
  if (!pileModal || !pileCardsContainer) return;
  document.getElementById('pile-modal-title').innerText = `${title} (${array.length})`;
  pileCardsContainer.innerHTML = '';

  array.forEach((card, index) => {
    const cardEl = createCardElement(card, false);
    cardEl.title = "Click to return to Hand";
    cardEl.addEventListener('click', () => {
      array.splice(index, 1);
      hand.push(card);
      renderHand();
      updatePilesUI();
      openPileModal(title, array);
      if (array.length === 0) pileModal.style.display = 'none';
    });
    pileCardsContainer.appendChild(cardEl);
  });

  pileModal.style.display = 'flex';
}

function updatePilesUI() {
  const dCount = document.getElementById('deck-count');
  const gCount = document.getElementById('graveyard-count');
  const eCount = document.getElementById('exile-count');
  if (dCount) dCount.innerText = deck.length;
  if (gCount) gCount.innerText = graveyard.length;
  if (eCount) eCount.innerText = exile.length;
}