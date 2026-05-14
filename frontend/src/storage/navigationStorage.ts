import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'bean-and-dash-active-tab';

export async function saveActiveTab(scope: string, tab: string) {
  await AsyncStorage.setItem(`${PREFIX}:${scope}`, tab);
}

export async function loadActiveTab(scope: string) {
  return AsyncStorage.getItem(`${PREFIX}:${scope}`);
}
