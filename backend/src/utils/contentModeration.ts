/**
 * Content Moderation Engine for Sift
 *
 * Provides:
 * 1. Spam Link Detection & Masking (URL shorteners, suspicious TLDs, phishing, scam redirects)
 * 2. Toxic Keyword & Abuse Detection & Masking (hate speech, scams, harassment, offensive slurs)
 * 3. Text Sanitization & Flagging API
 */

export interface ModerationResult {
  originalText: string;
  cleanText: string;
  isFlagged: boolean;
  spamLinksDetected: string[];
  toxicKeywordsDetected: string[];
  reasons: string[];
}

// ─── Spam Link Signatures & Suspicious Domains ───────────────────────────────
const SPAM_DOMAINS_AND_SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.me",
  "telegram.me",
  "wa.me",
  "chat.whatsapp.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "bitly.com",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "free-crypto",
  "airdrop-claim",
  "claim-bonus",
  "free-giftcard",
  "t.co",
];

const SUSPICIOUS_TLDS = [
  "\\.xyz",
  "\\.top",
  "\\.click",
  "\\.buzz",
  "\\.club",
  "\\.win",
  "\\.poker",
  "\\.casino",
  "\\.bet",
  "\\.link",
  "\\.work",
  "\\.cam",
  "\\.rest",
  "\\.cfd",
  "\\.sbs",
];

// Regex matching URLs, links, or IP addresses
const GENERAL_URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:xyz|top|click|buzz|club|win|poker|casino|bet|link|work|cam|rest|cfd|sbs)(?:\/[^\s]*)?)/gi;

// Safe domains allowed in captions (e.g., Unsplash, high-res design CDNs, Sift internal)
const ALLOWED_DOMAINS = [
  "unsplash.com",
  "images.unsplash.com",
  "sift.app",
  "github.com",
  "figma.com",
  "pinterest.com",
  "archdaily.com",
];

// ─── Toxic Keywords, Scam Patterns & Abusive Phrases ─────────────────────────
const TOXIC_PATTERNS = [
  // Financial Scams & Spam Bots
  "free crypto",
  "crypto giveaway",
  "guaranteed profit",
  "double your money",
  "earn \\$\\d+",
  "make \\$\\d+ daily",
  "whatsapp \\+\\d+",
  "telegram @[a-zA-Z0-9_]+",
  "dm for details",
  "sugar daddy",
  "sugar mommy",
  "send nudes",
  "click here to claim",
  "claim your reward",
  "free followers",
  "cashapp flip",
  "binary options",
  "forex trade signal",

  // Profanities, Harassment & Abuse
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "dickhead",
  "cunt",
  "whore",
  "slut",
  "kill yourself",
  "die trash",
  "nigger",
  "faggot",
  "retard",
];

/**
 * Checks if a detected URL is a known safe asset CDN or a spam link.
 */
function isSpamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  for (const allowed of ALLOWED_DOMAINS) {
    if (lower.includes(allowed)) {
      return false;
    }
  }

  // Check against shorteners
  for (const spam of SPAM_DOMAINS_AND_SHORTENERS) {
    if (lower.includes(spam)) {
      return true;
    }
  }

  // Check against suspicious TLDs
  for (const tld of SUSPICIOUS_TLDS) {
    const reg = new RegExp(tld + "(/|$|\\s)", "i");
    if (reg.test(lower)) {
      return true;
    }
  }

  // General untrusted external links posted in social captions/comments are treated as potential spam
  return true;
}

/**
 * Masks a toxic word preserving the first and last character when length > 3,
 * or replaces with asterisks.
 */
function maskWord(word: string): string {
  if (word.length <= 2) return "**";
  if (word.length === 3) return word[0] + "**";
  const innerMask = "*".repeat(word.length - 2);
  return `${word[0]}${innerMask}${word[word.length - 1]}`;
}

/**
 * Scans text and replaces any spam links with a secure placeholder mask.
 */
export function maskSpamLinks(text: string): { cleanText: string; detectedLinks: string[] } {
  if (!text) return { cleanText: "", detectedLinks: [] };

  const detectedLinks: string[] = [];

  const cleanText = text.replace(GENERAL_URL_REGEX, (matched) => {
    if (isSpamUrl(matched)) {
      detectedLinks.push(matched);
      return "[LINK REMOVED - SPAM DETECTED]";
    }
    return matched;
  });

  return { cleanText, detectedLinks };
}

/**
 * Scans text and replaces toxic, scam, or abusive phrases with masked tokens.
 */
export function maskToxicKeywords(text: string): { cleanText: string; detectedWords: string[] } {
  if (!text) return { cleanText: "", detectedWords: [] };

  let result = text;
  const detectedWords: string[] = [];

  for (const pattern of TOXIC_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    if (regex.test(result)) {
      result = result.replace(regex, (matched) => {
        detectedWords.push(matched);
        return maskWord(matched);
      });
    }
  }

  return { cleanText: result, detectedWords };
}

/**
 * Comprehensive Content Moderation Pipeline
 * Evaluates both spam links and toxic keywords, returning a sanitized string,
 * detection metadata, and whether the content should be flagged.
 */
export function moderateText(text: string): ModerationResult {
  if (!text || typeof text !== "string") {
    return {
      originalText: text || "",
      cleanText: text || "",
      isFlagged: false,
      spamLinksDetected: [],
      toxicKeywordsDetected: [],
      reasons: [],
    };
  }

  const reasons: string[] = [];

  // Step 1: Detect & mask spam links
  const { cleanText: textAfterLinks, detectedLinks } = maskSpamLinks(text);
  if (detectedLinks.length > 0) {
    reasons.push(`Contained ${detectedLinks.length} untrusted or spam link(s)`);
  }

  // Step 2: Detect & mask toxic keywords / scams
  const { cleanText: finalText, detectedWords } = maskToxicKeywords(textAfterLinks);
  if (detectedWords.length > 0) {
    reasons.push(`Contained ${detectedWords.length} toxic or prohibited term(s)`);
  }

  const isFlagged = detectedLinks.length > 0 || detectedWords.length > 0;

  return {
    originalText: text,
    cleanText: finalText,
    isFlagged,
    spamLinksDetected: detectedLinks,
    toxicKeywordsDetected: detectedWords,
    reasons,
  };
}

