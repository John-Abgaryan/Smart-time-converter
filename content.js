let bubble = null;
let debounceTimer = null;
let targetTimezone = 'auto';
let autoUnderlineEnabled = true;
let use24HourClock = false;
let inlineRefreshTimer = null;
let mutationObserver = null;

// Initialize bubble
function createBubble() {
  bubble = document.createElement('div');
  bubble.id = 'smart-time-converter-bubble';
  document.body.appendChild(bubble);
}

// Load user preferences
function loadPreference() {
  chrome.storage.sync.get(['targetTimezone', 'autoUnderlineEnabled', 'use24HourClock'], (result) => {
    targetTimezone = result.targetTimezone || 'auto';
    autoUnderlineEnabled = result.autoUnderlineEnabled !== false;
    use24HourClock = result.use24HourClock === true;
    refreshInlineHighlightsDebounced();
  });
}

// Listen for preference changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'sync') return;

  if (changes.targetTimezone) {
    targetTimezone = changes.targetTimezone.newValue || 'auto';
  }

  if (changes.autoUnderlineEnabled) {
    autoUnderlineEnabled = changes.autoUnderlineEnabled.newValue !== false;
  }

  if (changes.use24HourClock) {
    use24HourClock = changes.use24HourClock.newValue === true;
  }

  refreshInlineHighlightsDebounced();
});

// Regex to find time strings like "9 PM EST", "14:30 PST", "9:00 AM GMT"
// Matches: 1-12 or 0-23, optional :mm, optional AM/PM, and 3-4 letter timezone
const timeRegexSingle = /\b((?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:[AaPp][Mm])?|(?:[01]?[0-9]|2[0-3]):[0-5][0-9])\s*([A-Z]{3,4})\b/i;
const timeRegexGlobal = /\b((?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:[AaPp][Mm])?|(?:[01]?[0-9]|2[0-3]):[0-5][0-9])\s*([A-Z]{3,4})\b/gi;

// Map common abbreviations to IANA timezones for Luxon
const tzMap = {
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'GMT': 'Europe/London',
  'BST': 'Europe/London',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  'EET': 'Europe/Athens',
  'EEST': 'Europe/Athens',
  'JST': 'Asia/Tokyo',
  'IST': 'Asia/Kolkata',
  'AEST': 'Australia/Sydney',
  'AEDT': 'Australia/Sydney',
  'UTC': 'UTC'
};

function parseAndConvertTime(text) {
  const match = text.match(timeRegexSingle);
  if (!match) return null;

  let timeStr = match[1].trim();
  const tzAbbr = match[2].toUpperCase();

  const sourceZone = tzMap[tzAbbr];
  if (!sourceZone) return null;

  // Determine target zone
  let destZone = targetTimezone;
  if (destZone === 'auto') {
    destZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  try {
    const DateTime = luxon.DateTime;
    let parsedDate = null;
    
    // Clean up time string for parsing
    timeStr = timeStr.toUpperCase();
    
    // Try different formats
    const formats = ['h:mm a', 'h:mma', 'h a', 'ha', 'H:mm', 'h', 'H'];
    
    // To make parsing robust, we can use a base date (today) in the source timezone
    const now = DateTime.now().setZone(sourceZone);
    
    for (const fmt of formats) {
      parsedDate = DateTime.fromFormat(timeStr, fmt, { zone: sourceZone });
      if (parsedDate.isValid) {
        // Set the date to today to avoid issues with daylight saving transitions on 1970-01-01
        parsedDate = parsedDate.set({ year: now.year, month: now.month, day: now.day });
        break;
      }
    }

    if (!parsedDate || !parsedDate.isValid) return null;

    // Convert to target timezone
    const convertedDate = parsedDate.setZone(destZone);
    
    // Format output
    const outputFormat = use24HourClock ? 'HH:mm' : 'h:mm a';
    const formattedTime = convertedDate.toFormat(outputFormat);
    const destZoneName = destZone.split('/').pop().replace(/_/g, ' ');
    
    return `${formattedTime} (${destZoneName})`;
  } catch (e) {
    console.error("Smart Time Converter error:", e);
    return null;
  }
}

function showBubble(text, rect) {
  if (!bubble) createBubble();
  
  bubble.textContent = text;
  
  // Calculate position
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  
  // Position bubble centered above the selection
  bubble.style.left = `${rect.left + scrollX + (rect.width / 2)}px`;
  bubble.style.top = `${rect.top + scrollY - 40}px`; // 40px above the selection
  
  bubble.classList.add('show');
}

function hideBubble() {
  if (bubble) {
    bubble.classList.remove('show');
  }
}

function clearInlineHighlights() {
  const highlightedTimes = document.querySelectorAll('.smart-time-converter-inline-time');
  highlightedTimes.forEach((element) => {
    const parent = element.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(element.textContent || ''), element);
  });

  if (document.body) {
    document.body.normalize();
  }
}

function shouldSkipTextNode(node) {
  if (!node || !node.parentElement) return true;

  const parent = node.parentElement;
  const tag = parent.tagName;
  if (!tag) return true;

  if (
    tag === 'SCRIPT' ||
    tag === 'STYLE' ||
    tag === 'NOSCRIPT' ||
    tag === 'TEXTAREA' ||
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'OPTION' ||
    tag === 'PRE' ||
    tag === 'CODE'
  ) {
    return true;
  }

  if (parent.closest('.smart-time-converter-inline-time')) {
    return true;
  }

  if (parent.isContentEditable) {
    return true;
  }

  return false;
}

function buildHighlightedFragment(text) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let hasMatch = false;
  const regex = new RegExp(timeRegexGlobal.source, timeRegexGlobal.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    if (matchStart > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchStart)));
    }

    const sourceZoneAbbr = (match[2] || '').toUpperCase();
    if (tzMap[sourceZoneAbbr]) {
      const span = document.createElement('span');
      span.className = 'smart-time-converter-highlight smart-time-converter-inline-time';
      span.textContent = fullMatch;
      span.dataset.smartTimeValue = fullMatch;
      fragment.appendChild(span);
      hasMatch = true;
    } else {
      fragment.appendChild(document.createTextNode(fullMatch));
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return { fragment, hasMatch };
}

function applyInlineHighlights() {
  clearInlineHighlights();

  if (!autoUnderlineEnabled || !document.body) {
    return;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (shouldSkipTextNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (!node.nodeValue || !timeRegexSingle.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue || '';
    const { fragment, hasMatch } = buildHighlightedFragment(text);
    if (hasMatch && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
}

function refreshInlineHighlightsDebounced() {
  clearTimeout(inlineRefreshTimer);
  inlineRefreshTimer = setTimeout(() => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    applyInlineHighlights();

    if (mutationObserver && document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }, 250);
}

function initializeAutoHighlightWatcher() {
  if (!document.body) return;

  mutationObserver = new MutationObserver(() => {
    refreshInlineHighlightsDebounced();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  refreshInlineHighlightsDebounced();
}

document.addEventListener('mouseover', (event) => {
  if (!autoUnderlineEnabled) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const timeElement = target.closest('.smart-time-converter-inline-time');
  if (!timeElement) return;

  const rawTimeText = timeElement.dataset.smartTimeValue || timeElement.textContent || '';
  const convertedTime = parseAndConvertTime(rawTimeText.trim());
  if (!convertedTime) return;

  const rect = timeElement.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    showBubble(convertedTime, rect);
  }
});

document.addEventListener('mouseout', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const timeElement = target.closest('.smart-time-converter-inline-time');
  if (!timeElement) return;

  const related = event.relatedTarget;
  if (related instanceof Node && timeElement.contains(related)) {
    return;
  }

  hideBubble();
});

document.addEventListener('selectionchange', () => {
  clearTimeout(debounceTimer);
  
  debounceTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideBubble();
      return;
    }
    
    const text = selection.toString().trim();
    
    // Only process short selections to avoid performance issues
    if (text.length > 0 && text.length < 50) {
      const convertedTime = parseAndConvertTime(text);
      if (convertedTime) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Don't show if selection is invisible (e.g., width 0)
        if (rect.width > 0 && rect.height > 0) {
          showBubble(convertedTime, rect);
        } else {
          hideBubble();
        }
      } else {
        hideBubble();
      }
    } else {
      hideBubble();
    }
  }, 300); // 300ms debounce
});

// Initialize
loadPreference();
initializeAutoHighlightWatcher();
