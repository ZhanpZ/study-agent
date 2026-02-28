const MIN_TOPIC_LENGTH = 2;
const MAX_TOPIC_LENGTH = 100;

export function validateTopic(value) {
  if (value.length < MIN_TOPIC_LENGTH) {
    return `Topic must be at least ${MIN_TOPIC_LENGTH} characters`;
  }
  if (value.length > MAX_TOPIC_LENGTH) {
    return `Topic must be under ${MAX_TOPIC_LENGTH} characters`;
  }
  if (/^[^a-zA-Z0-9]+$/.test(value)) {
    return "Topic must contain letters or numbers";
  }
  return "";
}

export { MIN_TOPIC_LENGTH, MAX_TOPIC_LENGTH };
