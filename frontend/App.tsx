import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AuthProvider } from './src/context/AuthContext';
import { AppShell } from './src/screens/AppShell';

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 760;

  return (
    <AuthProvider>
      <View style={[styles.stage, isDesktop && styles.desktopStage]}>
        <SafeAreaView style={[styles.container, isDesktop && styles.desktopContainer]}>
          <AppShell />
          <StatusBar style="dark" />
        </SafeAreaView>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    backgroundColor: '#f4f6f3',
    flex: 1,
  },
  desktopStage: {
    backgroundColor: '#e8ece8',
    padding: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f6f3',
    width: '100%',
  },
  desktopContainer: {
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
});
