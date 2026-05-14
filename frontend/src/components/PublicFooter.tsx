import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export function PublicFooter({ onBrowseMenu }: { onBrowseMenu?: () => void }) {
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.footer, { width }]}>
      <View style={styles.inner}>
        <View style={styles.brandColumn}>
          <Text style={styles.brand}>Bean & Dash</Text>
          <Text style={styles.copy}>
            Fresh cafe meals, quick checkout, and live rider tracking across Nairobi.
          </Text>
        </View>

        <View style={styles.footerColumn}>
          <Text style={styles.heading}>Explore</Text>
          <Pressable onPress={onBrowseMenu}>
            <Text style={styles.link}>Menu</Text>
          </Pressable>
          <Text style={styles.link}>Live tracking</Text>
          <Text style={styles.link}>Order updates</Text>
        </View>

        <View style={styles.footerColumn}>
          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.link}>Nairobi, Kenya</Text>
          <Text style={styles.link}>support@beananddash.test</Text>
          <Text style={styles.link}>+254 700 000 000</Text>
        </View>

        <View style={styles.footerColumn}>
          <Text style={styles.heading}>Hours</Text>
          <Text style={styles.link}>Mon - Sat</Text>
          <Text style={styles.link}>7:00 AM - 9:00 PM</Text>
          <Text style={styles.link}>Sunday delivery available</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignSelf: 'stretch',
    backgroundColor: '#0f4f36',
    marginTop: 34,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  inner: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
    maxWidth: 1100,
    width: '100%',
  },
  brandColumn: {
    flexBasis: 240,
    flexGrow: 1,
    gap: 8,
  },
  brand: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  copy: {
    color: '#d9e7df',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 340,
  },
  footerColumn: {
    flexBasis: 150,
    flexGrow: 1,
    gap: 8,
  },
  heading: {
    color: '#ff9b58',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  link: {
    color: '#eef7f2',
    fontSize: 14,
    fontWeight: '700',
  },
});
