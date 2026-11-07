import { prisma } from "../lib/prisma";
import { UpdateSettingsInput } from "../validators/schemas";

export interface UserSettingsData {
  id: string;
  userId: string;
  pushNotifications: boolean;
  darkMode: boolean;
  language: string;
  profileVisibility: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default settings fallback for new or existing users without an explicit settings row.
 */
const DEFAULT_SETTINGS = {
  pushNotifications: true,
  darkMode: false,
  language: "en",
  profileVisibility: "public",
};

/**
 * Retrieves the settings for a user.
 * Auto-creates default settings if none currently exist in the database.
 */
export async function getSettingsByUserId(userId: string): Promise<UserSettingsData> {
  // Ensure the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found with id: ${userId}`);
  }

  const settings = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_SETTINGS,
    },
  });

  return settings;
}

/**
 * Updates a user's settings and privacy preferences.
 */
export async function updateSettingsByUserId(
  userId: string,
  data: UpdateSettingsInput
): Promise<UserSettingsData> {
  // Ensure user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found with id: ${userId}`);
  }

  const updated = await prisma.settings.upsert({
    where: { userId },
    update: {
      ...(data.pushNotifications !== undefined ? { pushNotifications: data.pushNotifications } : {}),
      ...(data.darkMode !== undefined ? { darkMode: data.darkMode } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.profileVisibility !== undefined ? { profileVisibility: data.profileVisibility } : {}),
    },
    create: {
      userId,
      pushNotifications: data.pushNotifications ?? DEFAULT_SETTINGS.pushNotifications,
      darkMode: data.darkMode ?? DEFAULT_SETTINGS.darkMode,
      language: data.language ?? DEFAULT_SETTINGS.language,
      profileVisibility: data.profileVisibility ?? DEFAULT_SETTINGS.profileVisibility,
    },
  });

  return updated;
}

