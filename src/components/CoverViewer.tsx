import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  visible: boolean;
  url: string | null;
  onClose: () => void;
};

export function CoverViewer({ visible, url, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  async function downloadToGallery() {
    if (!url) return;
    try {
      setSaving(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita acessar suas fotos pra salvar a capa.');
        return;
      }
      const target = `${FileSystem.cacheDirectory}figurinha-cover-${Date.now()}.png`;
      const dl = await FileSystem.downloadAsync(url, target);
      await MediaLibrary.saveToLibraryAsync(dl.uri);
      Alert.alert('Salvo!', 'A capa foi salva na sua galeria de fotos.');
    } catch (e: any) {
      Alert.alert('Não rolou', e?.message ?? 'Tenta de novo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.barBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={downloadToGallery}
            disabled={saving}
            hitSlop={12}
            style={[styles.barBtn, saving && { opacity: 0.5 }]}>
            <Ionicons name="download" size={22} color="#fff" />
          </Pressable>
        </View>

        {url && (
          <Image
            source={{ uri: url }}
            style={styles.image}
            contentFit="contain"
            pointerEvents="none"
          />
        )}

        <View style={[styles.hint, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hintText}>Toque fora pra fechar · ⬇ pra salvar na galeria</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  barBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
