let deck = [];
let hand = [];
let commander = null;
let boardState = {
  creatures: [],
  noncreatures: [],
  lands: []
};
let graveyard = [];
let exile = [];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function initGame() {
  try {
    const response = await fetch('cards.json');
    const rawCards = await response.json();
    
    deck = [];
    rawCards.forEach(card => {
      const isLegendary = card.type && card.type.toLowerCase().includes("legendary");
      if (isLegendary && !commander) {
        commander = { ...card, instanceId: "commander" };
      } else {
        const amount = card.count || 1;
        for (let i = 0; i < amount; i++) {
          deck.push({ ...card, instanceId: Math.random().toString(36).substr(2, 9) });
        }
      }
    });

    shuffle(deck);
    renderCommander();
    updatePilesUI();

    for (let i = 0; i < 7; i++) {
      drawCard();
    }

  } catch (error) {
    console.error("Failed to load cards.json:", error);
  }
}

function renderCommander() {
  const slot = document.getElementById('commander-card-slot');
  slot.innerHTML = '';
  if (commander) {
    const cardEl = createCardElement(commander);
    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      boardState.creatures.push(commander);
      commander = null;
      renderCommander();
      renderBoard();
    });
    slot.appendChild(cardEl);
  }
}

function drawCard() {
  if (deck.length === 0) return alert("No cards left in library!");
  
  const drawnCard = deck.pop();
  hand.push(drawnCard);
  
  updatePilesUI();
  renderHand();
}

function renderHand() {
  const handContainer = document.getElementById('player-hand');
  handContainer.innerHTML = '';

  const totalCards = hand.length;
  const maxAngle = 5; // Kartlar çok büyüdüğü için açı hafifletildi

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card);
    
    if (totalCards > 1) {
      const angle = -maxAngle + (index / (totalCards - 1)) * (maxAngle * 2);
      const translateY = Math.abs(angle) * 1.8;
      cardEl.style.transform = `rotate(${angle}deg) translateY(${translateY}px)`;
    }

    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      playCardToBoard(index);
    });
    handContainer.appendChild(cardEl);
  });
}

function playCardToBoard(handIndex) {
  const card = hand.splice(handIndex, 1)[0];
  const type = (card.type || '').toLowerCase();

  if (type.includes('land')) {
    boardState.lands.push(card);
  } else if (type.includes('creature')) {
    boardState.creatures.push(card);
  } else {
    boardState.noncreatures.push(card);
  }

  renderHand();
  renderBoard();
}

function renderBoard() {
  renderZone('creature-zone', boardState.creatures, 'creatures', 'Creatures');
  renderZone('noncreature-zone', boardState.noncreatures, 'noncreatures', 'Artifacts & Enchantments');
  renderZone('land-zone', boardState.lands, 'lands', 'Lands');
}

function renderZone(elementId, cardArray, stateKey, label) {
  const container = document.getElementById(elementId);
  container.innerHTML = `<span class="zone-label">${label}</span>`;

  cardArray.forEach((card, index) => {
    const cardEl = createCardElement(card);
    
    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      boardState[stateKey].splice(index, 1);
      graveyard.push(card);
      renderBoard();
      updatePilesUI();
    });

    container.appendChild(cardEl);
  });
}

function createCardElement(card) {
  const cardWrapper = document.createElement('div');
  cardWrapper.classList.add('card-wrapper');

  const imageUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=normal`;

  cardWrapper.innerHTML = `
    <img class="card-image" src="${imageUrl}" alt="${card.name}" loading="lazy" />
  `;

  // SAĞ TIK: Kartı büyütür
  cardWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openCardPreview(imageUrl);
  });

  return cardWrapper;
}

// POP-UP PREVIEW
function openCardPreview(url) {
  const modal = document.getElementById('card-preview-modal');
  const img = document.getElementById('preview-card-img');
  img.src = url;
  modal.style.display = 'flex';
}

document.getElementById('card-preview-modal').addEventListener('click', () => {
  document.getElementById('card-preview-modal').style.display = 'none';
});

function updatePilesUI() {
  document.getElementById('deck-count').innerText = deck.length;
  document.getElementById('graveyard-count').innerText = graveyard.length;
  document.getElementById('exile-count').innerText = exile.length;
}

// BUTONLAR
document.getElementById('deck-pile').addEventListener('click', drawCard);
document.getElementById('draw-btn').addEventListener('click', drawCard);
document.getElementById('shuffle-btn').addEventListener('click', () => {
  shuffle(deck);
  alert("Library shuffled!");
});

initGame();

// OYUNCU CAN SAYACI MANTIĞI
let myLife = 40;
const lifeDisplay = document.getElementById('my-life');

document.getElementById('my-life-up').addEventListener('click', () => {
  myLife++;
  lifeDisplay.innerText = myLife;
});

document.getElementById('my-life-down').addEventListener('click', () => {
  myLife--;
  lifeDisplay.innerText = myLife;
});