document.addEventListener('DOMContentLoaded', () => {
  const tzSelect = document.getElementById('timezone');
  const autoUnderlineToggle = document.getElementById('auto-underline');
  const darkModeToggle = document.getElementById('dark-mode');
  const saveBtn = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  const commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Athens',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Kolkata',
    'Australia/Sydney',
    'UTC'
  ];

  function formatTimezoneLabel(zone) {
    const parts = zone.split('/');
    const area = (parts[0] || '').replace(/_/g, ' ');
    const city = parts.slice(1).join('/').replace(/_/g, ' ');
    if (!city) return zone;
    return `${city} (${area})`;
  }

  function getAllSupportedTimezones() {
    if (typeof Intl.supportedValuesOf === 'function') {
      const supported = Intl.supportedValuesOf('timeZone');
      return supported.slice().sort((a, b) => a.localeCompare(b));
    }
    return commonTimezones.slice();
  }

  function buildTimezoneOptions() {
    const existingAuto = tzSelect.querySelector('option[value="auto"]');
    tzSelect.innerHTML = '';
    if (existingAuto) {
      tzSelect.appendChild(existingAuto);
    } else {
      const autoOption = document.createElement('option');
      autoOption.value = 'auto';
      autoOption.textContent = 'Auto-detect (Browser Local)';
      tzSelect.appendChild(autoOption);
    }

    const popularGroup = document.createElement('optgroup');
    popularGroup.label = 'Common Timezones';
    commonTimezones.forEach((zone) => {
      const option = document.createElement('option');
      option.value = zone;
      option.textContent = formatTimezoneLabel(zone);
      popularGroup.appendChild(option);
    });
    tzSelect.appendChild(popularGroup);

    const allGroup = document.createElement('optgroup');
    allGroup.label = 'All Countries/Regions';

    const allZones = getAllSupportedTimezones();
    allZones.forEach((zone) => {
      if (commonTimezones.includes(zone)) return;
      const option = document.createElement('option');
      option.value = zone;
      option.textContent = formatTimezoneLabel(zone);
      allGroup.appendChild(option);
    });

    tzSelect.appendChild(allGroup);
  }

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
  }

  buildTimezoneOptions();

  // Load saved preferences
  chrome.storage.sync.get(['targetTimezone', 'autoUnderlineEnabled', 'darkModeEnabled'], (result) => {
    if (result.targetTimezone) {
      tzSelect.value = result.targetTimezone;
    } else {
      tzSelect.value = 'auto';
    }

    autoUnderlineToggle.checked = result.autoUnderlineEnabled !== false;

    const darkModeEnabled = result.darkModeEnabled === true;
    darkModeToggle.checked = darkModeEnabled;
    applyTheme(darkModeEnabled);
  });

  darkModeToggle.addEventListener('change', () => {
    applyTheme(darkModeToggle.checked);
  });

  saveBtn.addEventListener('click', () => {
    const selectedTz = tzSelect.value;
    const autoUnderlineEnabled = autoUnderlineToggle.checked;
    const darkModeEnabled = darkModeToggle.checked;

    chrome.storage.sync.set({ targetTimezone: selectedTz, autoUnderlineEnabled, darkModeEnabled }, () => {
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 2000);
    });
  });
});