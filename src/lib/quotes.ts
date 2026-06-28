const QUOTES = [
  { q: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
  { q: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", a: "Aristotle" },
  { q: "Small disciplines repeated with consistency every day lead to great achievements.", a: "John C. Maxwell" },
  { q: "The successful warrior is the average man, with laser-like focus.", a: "Bruce Lee" },
  { q: "You will never always be motivated. You must learn to be disciplined.", a: "Unknown" },
  { q: "Discipline equals freedom.", a: "Jocko Willink" },
  { q: "It's not about perfect. It's about effort.", a: "Jillian Michaels" },
  { q: "The pain of discipline is far less than the pain of regret.", a: "Sarah Bombell" },
  { q: "Suffer the pain of discipline or suffer the pain of regret.", a: "Jim Rohn" },
  { q: "Don't wish it were easier; wish you were better.", a: "Jim Rohn" },
  { q: "Motivation gets you going, but discipline keeps you growing.", a: "John C. Maxwell" },
  { q: "What you do every day matters more than what you do once in a while.", a: "Gretchen Rubin" },
  { q: "The chains of habit are too light to be felt until they are too heavy to be broken.", a: "Warren Buffett" },
  { q: "Focus is a matter of deciding what things you're not going to do.", a: "John Carmack" },
];

export function getDailyQuote(date = new Date()) {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}