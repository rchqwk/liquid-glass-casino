import type { TourStep } from "../components/TourOverlay";

export const blackjackTourSteps: TourStep[] = [
  {
    page: "blackjack_lobby",
    selector: "[data-tour='bj-create-join']",
    title: "Create & join a table",
    body: "Start here. Create a new table (or join an existing public one). The tour continues inside the table.",
  },
  {
    page: "blackjack_lobby",
    selector: "[data-tour='bj-public-tables']",
    title: "Public tables",
    body: "These are open tables you can join. (Discord call tables are private and won’t show here.)",
  },
  {
    page: "blackjack_lobby",
    title: "Join a table to continue",
    body: "Join any table now. Once you’re inside the table screen, press Next to keep going.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-round-controls']",
    title: "Round controls",
    body: "This panel is where you bet, skip rounds, and see the timers. Betting happens on a short countdown.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-all-in']",
    title: "All-in",
    body: "Toggle this to instantly bet your full balance. It’s a quick way to lock in a max bet.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-place-bet']",
    title: "Place bet",
    body: "Place your bet during the betting phase. You can clear it before betting ends if you change your mind.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-specials']",
    title: "Specials (powerups)",
    body:
      "Powerups are the arcade layer: Boosts help you reach 21, Saves help you recover after a bust, Utility gives information/control, and rarer Magic/Mythic/Dealer cards can swing the whole round.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='mystery-box-bubble']",
    title: "Mystery boxes",
    body: "Open boxes to get random specials. Save them for comebacks, or open them between rounds to stock up.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-collectibles-bubble']",
    title: "Collectibles",
    body: "Cosmetic items you can place on the felt in Table Edit Mode. Drag to move, and tap × to return to inventory.",
  },
  {
    page: "blackjack_table",
    selector: "[data-tour='bj-chat-bubble']",
    title: "Room chat",
    body: "Chat with your table. Great for coordinating chaos and celebrating big wins.",
  },
];

