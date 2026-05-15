import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const AVATAR_BUCKET = "avatars";

type ProfileRow = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export type CurrentProfile = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  memberSince: string;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export async function fetchCurrentProfile(): Promise<{ profile: CurrentProfile | null; error: string | null }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { profile: null, error: userError.message };
  }

  if (!user) {
    return { profile: null, error: "Could not identify the current user." };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, avatar_path")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return { profile: null, error: profileError.message };
  }

  const metadata = user.user_metadata as
    | { username?: string; first_name?: string; last_name?: string }
    | undefined;

  const firstName = profileRow?.first_name?.trim() || metadata?.first_name?.trim() || "";
  const lastName = profileRow?.last_name?.trim() || metadata?.last_name?.trim() || "";
  const username = profileRow?.username?.trim() || metadata?.username?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const memberSince =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
      : "Unknown";
  const avatarPath = profileRow?.avatar_path?.trim() || null;

  return {
    profile: {
      id: user.id,
      email: user.email?.trim() ?? "No email found",
      username: username || "No username found",
      firstName: firstName || "",
      lastName: lastName || "",
      fullName: fullName || "No name found",
      memberSince,
      avatarPath,
      avatarUrl: getAvatarPublicUrl(avatarPath),
    },
    error: null,
  };
}

export function getAvatarPublicUrl(avatarPath: string | null | undefined) {
  return getAvatarPublicUrlWithVersion(avatarPath);
}

export function getAvatarPublicUrlWithVersion(avatarPath: string | null | undefined, version?: string | number) {
  if (!avatarPath) {
    return null;
  }

  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;

  if (version === undefined || version === null) {
    return publicUrl;
  }

  return `${publicUrl}?v=${encodeURIComponent(String(version))}`;
}

export function getProfileInitials(fullName: string, username?: string | null) {
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (initials) {
    return initials;
  }

  return username?.replace(/^@/, "").charAt(0).toUpperCase() || "?";
}

export async function pickAndUploadAvatar(options: {
  source: "camera" | "library";
  userId: string;
  currentAvatarPath: string | null;
}): Promise<{
  avatarPath: string | null;
  avatarUrl: string | null;
  error: string | null;
  cancelled: boolean;
}> {
  try {
    const permissionResult =
      options.source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: options.source === "camera" ? "Camera permission is required." : "Photo library permission is required.",
        cancelled: false,
      };
    }

    const pickerResult =
      options.source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
            mediaTypes: ["images"],
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
            mediaTypes: ["images"],
          });

    if (pickerResult.canceled || !pickerResult.assets[0]) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: null,
        cancelled: true,
      };
    }

    const asset = pickerResult.assets[0];
    const extension = getImageExtension(asset.uri, asset.mimeType);
    const nextAvatarPath = `${options.userId}/avatar.${extension}`;
    const base64File = asset.base64?.trim() ?? "";

    if (!base64File) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: "The selected image could not be read.",
        cancelled: false,
      };
    }

    const fileBytes = Buffer.from(base64File, "base64");
    const byteLength = fileBytes.byteLength;

    if (byteLength === 0) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: "The selected image was empty.",
        cancelled: false,
      };
    }

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(nextAvatarPath, fileBytes, {
      cacheControl: "3600",
      upsert: true,
      contentType: asset.mimeType ?? `image/${extension}`,
    });

    if (uploadError) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: uploadError.message,
        cancelled: false,
      };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_path: nextAvatarPath,
      })
      .eq("id", options.userId);

    if (profileError) {
      return {
        avatarPath: options.currentAvatarPath,
        avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
        error: profileError.message,
        cancelled: false,
      };
    }

    if (options.currentAvatarPath && options.currentAvatarPath !== nextAvatarPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([options.currentAvatarPath]);
    }

    return {
      avatarPath: nextAvatarPath,
      avatarUrl: getAvatarPublicUrlWithVersion(nextAvatarPath, Date.now()),
      error: null,
      cancelled: false,
    };
  } catch (error: unknown) {
    return {
      avatarPath: options.currentAvatarPath,
      avatarUrl: getAvatarPublicUrl(options.currentAvatarPath),
      error: error instanceof Error ? error.message : "Could not upload your profile photo.",
      cancelled: false,
    };
  }
}

export async function removeAvatar(options: {
  userId: string;
  currentAvatarPath: string | null;
}): Promise<{
  avatarPath: null;
  avatarUrl: null;
  error: string | null;
}> {
  try {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_path: null,
      })
      .eq("id", options.userId);

    if (profileError) {
      return {
        avatarPath: null,
        avatarUrl: null,
        error: profileError.message,
      };
    }

    if (options.currentAvatarPath) {
      const { error: storageError } = await supabase.storage.from(AVATAR_BUCKET).remove([options.currentAvatarPath]);

      if (storageError) {
        return {
          avatarPath: null,
          avatarUrl: null,
          error: storageError.message,
        };
      }
    }

    return {
      avatarPath: null,
      avatarUrl: null,
      error: null,
    };
  } catch (error: unknown) {
    return {
      avatarPath: null,
      avatarUrl: null,
      error: error instanceof Error ? error.message : "Could not remove your profile photo.",
    };
  }
}

function getImageExtension(uri: string, mimeType?: string | null) {
  if (mimeType) {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType === "image/jpeg") {
      return "jpg";
    }

    if (normalizedMimeType === "image/png") {
      return "png";
    }

    if (normalizedMimeType === "image/webp") {
      return "webp";
    }
  }

  const uriMatch = uri.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  const uriExtension = uriMatch?.[1];

  if (uriExtension === "jpeg") {
    return "jpg";
  }

  if (uriExtension) {
    return uriExtension;
  }

  return "jpg";
}
