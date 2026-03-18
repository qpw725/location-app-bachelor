import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  avatarUrl: string | null;
  initials: string;
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  isUploading?: boolean;
};

export default function ProfileAvatar({
  avatarUrl,
  initials,
  size = 96,
  onPress,
  disabled = false,
  isUploading = false,
}: Props) {
  const circleRadius = size / 2;
  const avatarStyles = [
    styles.avatar,
    {
      width: size,
      height: size,
      borderRadius: circleRadius,
    },
  ];

  const content = (
    <View style={avatarStyles}>
      <View style={[styles.innerCircle, { borderRadius: circleRadius }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.initialsFill}>
            <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
          </View>
        )}
        {isUploading ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Saving...</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || isUploading} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0c2149",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  innerCircle: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  initialsFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#e3e7ef",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "800",
    color: "#1f4fa3",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 31, 58, 0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.88,
  },
});
