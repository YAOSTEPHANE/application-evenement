import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "event_rfid_session_token";
const USER_ID_KEY = "event_rfid_session_user";

export async function getSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, USER_ID_KEY]);
}

export async function setSessionUserId(userId: string): Promise<void> {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

export async function getSessionUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}
