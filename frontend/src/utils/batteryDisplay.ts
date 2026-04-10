const PERCENT_KEY = 'remoteterm-show-battery-percent';
const VOLTAGE_KEY = 'remoteterm-show-battery-voltage';

export function getShowBatteryPercent(): boolean {
  try {
    return localStorage.getItem(PERCENT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setShowBatteryPercent(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(PERCENT_KEY, 'true');
    } else {
      localStorage.removeItem(PERCENT_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function getShowBatteryVoltage(): boolean {
  try {
    return localStorage.getItem(VOLTAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setShowBatteryVoltage(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(VOLTAGE_KEY, 'true');
    } else {
      localStorage.removeItem(VOLTAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}
