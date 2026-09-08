// Kate's Taro Shop — 타로 78장 카드 목록
//
// 타로 덱은 두 부분으로 나뉜다.
//   메이저 아르카나 22장 — 이름이 제각각이라 그대로 적는다
//   마이너 아르카나 56장 — 4개 무늬 × 14개 계급이라 조합으로 만들어낸다
//
// 이 앱은 정방향만 쓴다. 역방향은 없다.

// 메이저 아르카나 22장 (0번 The Fool ~ 21번 The World)
const MAJOR_ARCANA = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];

// 마이너 아르카나를 만드는 재료
const SUITS = ["Wands", "Cups", "Swords", "Pentacles"];   // 무늬 4개
const RANKS = [                                            // 계급 14개
  "Ace", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King",
];

// 무늬마다 14개 계급을 붙여 56장을 만든다 — "Ace of Wands" 같은 형태
const MINOR_ARCANA = SUITS.flatMap((suit) =>
  RANKS.map((rank) => `${rank} of ${suit}`)
);

// 전체 78장
const TAROT_DECK = [...MAJOR_ARCANA, ...MINOR_ARCANA];

// 덱에서 무작위로 한 장 뽑는다
function drawCard() {
  const i = Math.floor(Math.random() * TAROT_DECK.length);
  return TAROT_DECK[i];
}
