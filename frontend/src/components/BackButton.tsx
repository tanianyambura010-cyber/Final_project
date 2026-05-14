import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

type BackButtonProps = {
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ label = 'Go back', onPress, style }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, style]}
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  arrow: {
    color: '#151815',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
});
