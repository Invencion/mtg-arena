let selectedContextCard = null;
let selectedContextLocation = null; // 'hand', 'board', 'pile'

function createCardElement(card, isBoardCard = false) {
  const cardWrapper = document.createElement('div');
  cardWrapper.classList.add('card-wrapper');
  cardWrapper.dataset.instanceId = card.instanceId;

  if (card.isTapped) {
    cardWrapper.classList.add('tapped');
  }

  const imageUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=normal`;

  cardWrapper.innerHTML = `
    <img class="card-image" src="${imageUrl}" alt="${card.name}" loading="lazy" />
  `;

  // TEK TIKLAMA: Sahadaysa Tap/Untap Yapar
  if (isBoardCard) {
    cardWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      card.isTapped = !card.isTapped;
      cardWrapper.classList.toggle('tapped', card.isTapped);
    });
  }

  // SAĞ TIKLAMA: Context Menüsünü Açar
  cardWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectedContextCard = card;
    showContextMenu(e.clientX, e.clientY, imageUrl);
  });

  return cardWrapper;
}

function showContextMenu(x, y, imageUrl) {
  const menu = document.getElementById('card-context-menu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'block';

  // Preview seçeneği event'i
  document.getElementById('ctx-preview').onclick = () => {
    openCardPreview(imageUrl);
    hideContextMenu();
  };
}

function hideContextMenu() {
  const menu = document.getElementById('card-context-menu');
  menu.style.display = 'none';
}

document.addEventListener('click', () => {
  hideContextMenu();
});

function openCardPreview(url) {
  const modal = document.getElementById('card-preview-modal');
  const img = document.getElementById('preview-card-img');
  img.src = url;
  modal.style.display = 'flex';
}

document.getElementById('card-preview-modal').addEventListener('click', () => {
  document.getElementById('card-preview-modal').style.display = 'none';
});