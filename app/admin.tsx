
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collectionGroup,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../src/lib/firebase";
import { useAuth } from "../src/auth/AuthProvider";

type AdminTask = {
  id: string;
  ownerId: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

const colors = {
  background: "#101014",
  surface: "#19191f",
  border: "#30303a",
  text: "#f5f5f7",
  muted: "#a2a2b2",
  accent: "#a78bfa",
  green: "#6ee7b7",
  red: "#fca5a5",
};

export default function AdminScreen() {
  const { user, role, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || role !== "admin") {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }

    let active = true;

    const unsubscribe = onSnapshot(
      collectionGroup(db, "tasks"),
      (snapshot) => {
        if (!active) return;

        const records: AdminTask[] = snapshot.docs.map((item) => {
          const data = item.data();
          const timestamp = data.createdAt;

          return {
            id: item.id,
            ownerId: item.ref.parent.parent?.id ?? "unknown",
            title: typeof data.title === "string" ? data.title : "",
            completed: data.completed === true,
            createdAt:
              typeof timestamp?.toMillis === "function"
                ? timestamp.toMillis()
                : 0,
          };
        });

        records.sort((a, b) => b.createdAt - a.createdAt);
        setTasks(records);
        setError(null);
        setLoadingTasks(false);
      },
      (err) => {
        if (!active) return;

        console.error("Admin task query failed:", err.code);
        setError(
          "Could not load administrative data. Verify your admin claim and Firestore rules."
        );
        setLoadingTasks(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, role]);

  const owners = useMemo(
    () => new Set(tasks.map((task) => task.ownerId)).size,
    [tasks]
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks]
  );

  if (!user || role !== "admin") {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Access denied</Text>
        <Text style={styles.muted}>
          An authorized administrator account is required.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.replace("/dashboard")}
        >
          <Text style={styles.buttonText}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={styles.heading}>Admin overview</Text>
          <Text style={styles.muted}>{user.email}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.replace("/dashboard")}
        >
          <Text style={styles.buttonText}>Dashboard</Text>
        </Pressable>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Administrator access</Text>
        <Text style={styles.muted}>
          This page requires the trusted Firebase admin custom claim.
          Administrative permissions are also enforced by Firestore rules.
        </Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Total tasks" value={tasks.length} />
        <StatCard label="Completed" value={completedCount} />
        <StatCard label="Pending" value={tasks.length - completedCount} />
        <StatCard label="Owners with tasks" value={owners} />
      </View>

      <Text style={styles.sectionTitle}>Recent tasks</Text>

      {loadingTasks ? (
        <ActivityIndicator color={colors.accent} size="large" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.muted}>No tasks found.</Text>
      ) : (
        tasks.slice(0, 20).map((task) => (
          <View key={`${task.ownerId}-${task.id}`} style={styles.task}>
            <View style={styles.taskTop}>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {task.title || "Untitled task"}
              </Text>
              <Text
                style={[
                  styles.status,
                  {
                    color: task.completed
                      ? colors.green
                      : colors.accent,
                  },
                ]}
              >
                {task.completed ? "Completed" : "Pending"}
              </Text>
            </View>
            <Text style={styles.muted}>Owner UID: {task.ownerId}</Text>
          </View>
        ))
      )}

      <Pressable
        accessibilityRole="button"
        style={[styles.button, styles.signOut]}
        onPress={() => void logout()}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 22,
    paddingTop: 38,
    paddingBottom: 48,
    gap: 20,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.background,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 8,
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    gap: 8,
  },
  noticeTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  statValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
  },
  task: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  taskTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
  },
  error: {
    color: colors.red,
    lineHeight: 21,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "#171320",
    fontWeight: "700",
    fontSize: 13,
  },
  signOut: {
    marginTop: 8,
  },
});
