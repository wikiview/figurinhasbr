import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/hooks/useTheme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textFaint,
        tabBarStyle: {
          paddingTop: 4,
          height: 64,
          paddingBottom: 8,
          backgroundColor: t.tabBg,
          borderTopColor: t.tabBorder,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: t.bgElevated },
        headerTitleStyle: { color: t.text, fontWeight: '800' },
        headerTintColor: t.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Coleção',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="trophy" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="caderneta"
        options={{
          title: 'Caderneta',
          headerShown: true,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="notebook-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Trocas',
          headerShown: true,
          tabBarIcon: ({ color }) => (
            <Ionicons name="swap-horizontal" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rarities"
        options={{
          title: 'Raridades',
          headerShown: true,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="diamond-stone" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          headerShown: true,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle-outline" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
