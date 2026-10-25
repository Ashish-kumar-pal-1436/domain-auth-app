
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../src/lib/firebase";
import { useAuth } from "../src/auth/AuthProvider";

type Priority = "High" | "Medium" | "Low";
type Filter =
  | "All"
  | "Pending"
  | "Completed"
  | "Due today"
  | "Overdue"
  | "High priority";

type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: Priority;
  dueDate: string;
};

const theme = {
  bg: "#090A0D",
  surface: "#101217",
  raised: "#151820",
  border: "#262A34",
  text: "#F5F3F0",
  muted: "#9295A2",
  dim: "#626775",
  purple: "#B6A4FF",
  purpleBg: "#211D31",
  lime: "#D5F477",
  red: "#FF818D",
  amber: "#F4C77B",
  green: "#8CDEB7",
};

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const taskQuery = query(
      collection(db, "users", user.uid, "tasks"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(
          snapshot.docs.map((item) => {
            const data = item.data();
            const value = data.priority;

            return {
              id: item.id,
              title: String(data.title ?? ""),
              description: typeof data.description === "string" ? data.description : "",
              completed: Boolean(data.completed),
              priority:
                value === "High" || value === "Low" || value === "Medium"
                  ? value
                  : "Medium",
              dueDate:
                typeof data.dueDate === "string" ? data.dueDate : "",
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error("Firestore read error:", err);
        setError("Unable to load tasks. Check your connection and Firestore rules.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  async function addTask() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !user || saving) {
      if (!cleanTitle) setError("Please enter a task title.");
      return;
    }

    if (cleanTitle.length > 200 || cleanDescription.length > 500) {
      setError("Keep the title under 200 characters and description under 500.");
      return;
    }

    if (
      dueDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
        Number.isNaN(Date.parse(`${dueDate}T00:00:00`)) ||
        new Date(`${dueDate}T00:00:00`).toISOString().slice(0, 10) !== dueDate)
    ) {
      setError("Use a valid date in YYYY-MM-DD format.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const taskData = {
        title: cleanTitle,
        description: cleanDescription,
        priority,
        dueDate,
      };

      if (editingTaskId) {
        await updateDoc(doc(db, "users", user.uid, "tasks", editingTaskId), taskData);
      } else {
        await addDoc(collection(db, "users", user.uid, "tasks"), {
          ...taskData,
          completed: false,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (err) {
      console.error("Firestore save error:", err);
      setError(editingTaskId ? "Couldn't update this task." : "Couldn't save the task. Check your Firestore rules.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("Medium");
    setEditingTaskId(null);
    setError("");
  }

  function startEditing(task: Task) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setError("");
  }

  async function toggleTask(task: Task) {
    if (!user) return;

    setError("");

    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        completed: !task.completed,
      });
    } catch (err) {
      console.error("Firestore update error:", err);
      setError("Couldn't update this task.");
    }
  }

  function deleteTask(taskId: string, taskTitle: string) {
    if (!user) return;

    Alert.alert(
      "Delete task?",
      `“${taskTitle}” will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setError("");
            void deleteDoc(doc(db, "users", user.uid, "tasks", taskId)).catch((err) => {
              console.error("Firestore delete error:", err);
              setError("Couldn't delete this task. Please try again.");
            });
          },
        },
      ]
    );
  }

  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const highPriority = tasks.filter(
    (task) => !task.completed && task.priority === "High"
  ).length;

  
  const today = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const queryText = search.trim().toLowerCase();

      const matchesSearch =
        task.title.toLowerCase().includes(queryText) ||
        task.description.toLowerCase().includes(queryText);

      const isOverdue =
        !task.completed && !!task.dueDate && task.dueDate < today;

      const isDueToday =
        !task.completed && task.dueDate === today;

      const matchesFilter =
        filter === "All" ||
        (filter === "Pending" && !task.completed) ||
        (filter === "Completed" && task.completed) ||
        (filter === "Due today" && isDueToday) ||
        (filter === "Overdue" && isOverdue) ||
        (filter === "High priority" &&
          !task.completed &&
          task.priority === "High");

      return matchesSearch && matchesFilter;
    });

    const priorityRank: Record<Priority, number> = {
      High: 0,
      Medium: 1,
      Low: 2,
    };

    return filtered.sort((a, b) => {
      if (filter === "All") return 0;

      if (filter === "Overdue" || filter === "Due today") {
        return a.dueDate.localeCompare(b.dueDate);
      }

      return (
        priorityRank[a.priority] - priorityRank[b.priority] ||
        (a.dueDate || "9999-12-31").localeCompare(
          b.dueDate || "9999-12-31"
        )
      );
    });
  }, [tasks, search, filter, today]);


  function priorityColor(value: Priority) {
    if (value === "High") return theme.red;
    if (value === "Medium") return theme.amber;
    return theme.green;
  }

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.pageContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.container}>
        {/* Brand bar */}
        <View style={s.topbar}>
          <View style={s.brandGroup}>
            <View style={s.brandMark}>
              <Text style={s.brandMarkText}>t.</Text>
            </View>
            <View>
              <Text style={s.brandName}>taskboard</Text>
              <Text style={s.brandDescriptor}>PERSONAL PRODUCTIVITY</Text>
            </View>
          </View>

          <View style={s.topbarRight}>
            <View style={s.liveStatus}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>SYNC ACTIVE</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void logout()}
              style={s.logoutButton}
            >
              <Text style={s.logoutText}>Sign out ↗</Text>
            </Pressable>
          </View>
        </View>

        {/* Editorial hero */}
        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={s.overline}>
              <Text style={s.overlineAccent}>01</Text>
              {"   /   YOUR WORKSPACE"}
            </Text>
            <Text style={s.heroTitle}>
              Less noise.{"\n"}
              <Text style={s.heroItalic}>More progress.</Text>
            </Text>
            <Text style={s.heroSubtitle}>
              Your goals deserve your attention. Keep the busywork organised
              and focus on what moves you forward.
            </Text>
          </View>

          <View style={s.focusCard}>
            <View style={s.focusCardTop}>
              <Text style={s.focusLabel}>YOUR MOMENTUM</Text>
              <Text style={s.focusSpark}>✳</Text>
            </View>

            <View style={s.progressLine}>
              <Text style={s.focusNumber}>{progress}</Text>
              <Text style={s.focusPercent}>%</Text>
            </View>

            <Text style={s.focusDescription}>completion rate</Text>

            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${progress}%` },
                ]}
              />
            </View>

            <View style={s.focusBottom}>
              <Text style={s.focusBottomText}>
                {completed} completed
              </Text>
              <Text style={s.focusBottomText}>
                {pending} remaining
              </Text>
            </View>
          </View>
        </View>

        {/* Account strip */}
        <View style={s.accountStrip}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(user?.displayName || user?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={s.accountInfo}>
            <Text style={s.accountName}>
              {user?.displayName || "Your workspace"}
            </Text>
            <Text style={s.accountEmail}>{user?.email}</Text>
          </View>

          <View style={s.accountBadge}>
            <Text style={s.accountBadgeText}>●  AUTHENTICATED</Text>
          </View>
        </View>

        {/* Overview */}
        <View style={s.sectionHeading}>
          <View>
            <Text style={s.sectionEyebrow}>AT A GLANCE</Text>
            <Text style={s.sectionTitle}>The overview</Text>
          </View>
          <Text style={s.sectionAside}>LIVE TASK DATA ↗</Text>
        </View>

        <View style={s.statsGrid}>
          <View style={[s.statCard, s.statCardFeatured]}>
            <View style={s.statTop}>
              <Text style={s.statLabel}>TOTAL TASKS</Text>
              <Text style={s.statSymbol}>↗</Text>
            </View>
            <Text style={s.statValue}>{tasks.length}</Text>
            <Text style={s.statFoot}>Everything on your plate</Text>
          </View>

          <View style={s.statCard}>
            <View style={s.statTop}>
              <Text style={s.statLabel}>IN PROGRESS</Text>
              <View style={[s.statDot, { backgroundColor: theme.amber }]} />
            </View>
            <Text style={s.statValue}>{pending}</Text>
            <Text style={s.statFoot}>One step at a time</Text>
          </View>

          <View style={s.statCard}>
            <View style={s.statTop}>
              <Text style={s.statLabel}>COMPLETED</Text>
              <View style={[s.statDot, { backgroundColor: theme.green }]} />
            </View>
            <Text style={s.statValue}>{completed}</Text>
            <Text style={s.statFoot}>Progress made visible</Text>
          </View>

          <View style={s.statCard}>
            <View style={s.statTop}>
              <Text style={s.statLabel}>HIGH PRIORITY</Text>
              <View style={[s.statDot, { backgroundColor: theme.red }]} />
            </View>
            <Text style={s.statValue}>{highPriority}</Text>
            <Text style={s.statFoot}>Needs extra attention</Text>
          </View>
        </View>

        {/* Create task */}
        <View style={s.sectionHeading}>
          <View>
            <Text style={s.sectionEyebrow}>MAKE IT HAPPEN</Text>
            <Text style={s.sectionTitle}>Capture a thought.</Text>
          </View>
          <Text style={s.sectionAside}>NEW ENTRY / 01</Text>
        </View>

        <View style={s.createCard}>
          <View style={s.createIntro}>
            <View style={s.createIcon}>
              <Text style={s.createIconText}>＋</Text>
            </View>
            <View style={s.createIntroText}>
              <Text style={s.createTitle}>Add to your list</Text>
              <Text style={s.createSubtitle}>
                Start small. Make it specific.
              </Text>
            </View>
          </View>

          <Text style={s.fieldLabel}>WHAT NEEDS DOING?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => void addTask()}
            placeholder="Write your next task..."
            placeholderTextColor={theme.dim}
            maxLength={200}
            returnKeyType="done"
            accessibilityLabel="New task title"
            style={s.input}
          />

          <Text style={s.fieldLabel}>DESCRIPTION / OPTIONAL</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add a few details to help you get it done..."
            placeholderTextColor={theme.dim}
            maxLength={500}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Task description"
            style={s.descriptionInput}
          />

          <View style={s.formColumns}>
            <View style={s.formColumn}>
              <Text style={s.fieldLabel}>PRIORITY LEVEL</Text>
              <View style={s.priorityGroup}>
                {(["Low", "Medium", "High"] as Priority[]).map((p) => (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityState={{ selected: priority === p }}
                    onPress={() => setPriority(p)}
                    style={[
                      s.priorityButton,
                      priority === p && s.prioritySelected,
                      priority === p && {
                        borderColor: priorityColor(p),
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.priorityDot,
                        { backgroundColor: priorityColor(p) },
                      ]}
                    />
                    <Text
                      style={[
                        s.priorityText,
                        priority === p && { color: priorityColor(p) },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.formColumn}>
              <Text style={s.fieldLabel}>DEADLINE / OPTIONAL</Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.dim}
                maxLength={10}
                style={s.input}
                accessibilityLabel="Task deadline"
              />
            </View>
          </View>

          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}

          <View style={s.createFooter}>
            <Text style={s.formHint}>
              {editingTaskId ? "EDITING EXISTING TASK" : "TITLE 200 / DETAILS 500 CHARS"}
            </Text>
            <View style={s.formActions}>
              {editingTaskId && (
                <Pressable accessibilityRole="button" onPress={resetForm} style={s.cancelEditButton}>
                  <Text style={s.cancelEditText}>Cancel</Text>
                </Pressable>
              )}
            <Pressable
              accessibilityRole="button"
              disabled={!title.trim() || saving}
              onPress={() => void addTask()}
              style={[
                s.addButton,
                (!title.trim() || saving) && s.disabledButton,
              ]}
            >
              <Text style={s.addButtonText}>
                {saving ? "Saving..." : editingTaskId ? "Save changes  ↗" : "Create task  ↗"}
              </Text>
            </Pressable>
            </View>
          </View>
        </View>

        {/* Task list */}
        <View style={s.sectionHeading}>
          <View>
            <Text style={s.sectionEyebrow}>YOUR PERSONAL QUEUE</Text>
            <Text style={s.sectionTitle}>The task list.</Text>
          </View>
          <View style={s.taskCount}>
            <Text style={s.taskCountText}>
              {visibleTasks.length.toString().padStart(2, "0")} ITEMS
            </Text>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="⌕    Search tasks by name..."
          placeholderTextColor={theme.dim}
          style={s.searchInput}
          accessibilityLabel="Search tasks"
        />

        <View style={s.filterBar}>
          {(
  [
    "All",
    "Pending",
    "Completed",
    "Due today",
    "Overdue",
    "High priority",
  ] as Filter[]
).map((item) =>  (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => setFilter(item)}
              style={[
                s.filterButton,
                filter === item && s.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  s.filterText,
                  filter === item && s.filterTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color={theme.purple} />
            <Text style={s.emptyDescription}>Loading your workspace...</Text>
          </View>
        ) : visibleTasks.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptySymbol}>✳</Text>
            <Text style={s.emptyTitle}>
              {tasks.length === 0 ? "A clean slate." : "No matches found."}
            </Text>
            <Text style={s.emptyDescription}>
              {tasks.length === 0
                ? "Your next great idea can start right here."
                : "Try another search or switch your filter."}
            </Text>
          </View>
        ) : (
          <View style={s.taskList}>
            {visibleTasks.map((task, index) => (
              <View key={task.id} style={s.taskRow}>
                <Text style={s.taskIndex}>
                  {(index + 1).toString().padStart(2, "0")}
                </Text>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.completed }}
                  accessibilityLabel={`Mark ${task.title} ${
                    task.completed ? "pending" : "completed"
                  }`}
                  onPress={() => void toggleTask(task)}
                  style={[
                    s.checkbox,
                    task.completed && s.checkboxChecked,
                  ]}
                >
                  <Text style={s.checkmark}>
                    {task.completed ? "✓" : ""}
                  </Text>
                </Pressable>

                <View style={s.taskBody}>
                  <Text
                    style={[
                      s.taskTitle,
                      task.completed && s.taskTitleDone,
                    ]}
                  >
                    {task.title}
                  </Text>
                  {!!task.description && (
                    <Text style={s.taskDescription}>{task.description}</Text>
                  )}
                  <View style={s.taskMeta}>
                    <View
                      style={[
                        s.priorityBadge,
                        {
                          backgroundColor: `${priorityColor(task.priority)}12`,
                          borderColor: `${priorityColor(task.priority)}35`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.priorityBadgeText,
                          { color: priorityColor(task.priority) },
                        ]}
                      >
                        {task.priority.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={s.taskStatus}>
                      {task.completed ? "DONE" : "IN PROGRESS"}
                    </Text>
                    {!!task.dueDate && (
                      <Text style={s.taskDue}>DUE {task.dueDate}</Text>
                    )}
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${task.title}`}
                  onPress={() => startEditing(task)}
                  style={s.editButton}
                >
                  <Text style={s.editText}>Edit</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${task.title}`}
                  onPress={() => deleteTask(task.id, task.title)}
                  style={s.deleteButton}
                >
                  <Text style={s.deleteText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text style={s.footerBrand}>taskboard / STUDIO</Text>
          <Text style={s.footerNote}>BUILT FOR YOUR NEXT CHAPTER.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  pageContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 36 },
  container: { width: "100%", maxWidth: 1000, alignSelf: "center" },

  topbar: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: 43,
  },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: theme.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { color: "#17190D", fontSize: 28, fontWeight: "900" },
  brandName: {
    color: theme.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  brandDescriptor: {
    color: theme.dim,
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  topbarRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  liveStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: theme.green },
  liveText: { color: theme.muted, fontSize: 8, letterSpacing: 1 },
  logoutButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.surface,
  },
  logoutText: { color: theme.text, fontSize: 11, fontWeight: "600" },

  hero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 28,
    marginBottom: 35,
  },
  heroCopy: { flex: 1, minWidth: 260 },
  overline: {
    color: theme.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 19,
  },
  overlineAccent: { color: theme.lime },
  heroTitle: {
    color: theme.text,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: "800",
    letterSpacing: -2,
  },
  heroItalic: { color: theme.purple, fontWeight: "500" },
  heroSubtitle: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 21,
    marginTop: 16,
    maxWidth: 410,
  },
  focusCard: {
    width: 255,
    maxWidth: "100%",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 17,
    padding: 19,
  },
  focusCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  focusLabel: {
    color: theme.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  focusSpark: { color: theme.lime, fontSize: 19 },
  progressLine: { flexDirection: "row", alignItems: "baseline", marginTop: 19 },
  focusNumber: { color: theme.text, fontSize: 51, fontWeight: "700", letterSpacing: -2 },
  focusPercent: { color: theme.purple, fontSize: 20, fontWeight: "700" },
  focusDescription: { color: theme.muted, fontSize: 10, marginTop: -1 },
  progressTrack: {
    height: 5,
    backgroundColor: theme.border,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 21,
  },
  progressFill: { height: "100%", backgroundColor: theme.lime, borderRadius: 5 },
  focusBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  focusBottomText: { color: theme.muted, fontSize: 9 },

  accountStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
    paddingVertical: 15,
    marginBottom: 39,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: theme.purple, fontSize: 15, fontWeight: "800" },
  accountInfo: { flex: 1, minWidth: 0 },
  accountName: { color: theme.text, fontSize: 11, fontWeight: "700" },
  accountEmail: { color: theme.muted, fontSize: 10, marginTop: 4 },
  accountBadge: {
    borderWidth: 1,
    borderColor: "#284438",
    backgroundColor: "#13251D",
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  accountBadgeText: { color: theme.green, fontSize: 8, fontWeight: "800" },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 17,
  },
  sectionEyebrow: {
    color: theme.dim,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 7,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  sectionAside: {
    color: theme.dim,
    fontSize: 8,
    letterSpacing: 1,
    paddingBottom: 4,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 43,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 155,
    minWidth: 125,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 13,
    padding: 15,
    minHeight: 130,
  },
  statCardFeatured: {
    borderColor: "#423A60",
    backgroundColor: "#171522",
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: { color: theme.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  statSymbol: { color: theme.purple, fontSize: 15 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statValue: {
    color: theme.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.2,
    marginTop: 17,
  },
  statFoot: { color: theme.dim, fontSize: 9, marginTop: 5 },

  createCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 21,
    marginBottom: 43,
  },
  createIntro: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  createIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    backgroundColor: theme.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },
  createIconText: { color: theme.purple, fontSize: 24 },
  createIntroText: { flex: 1 },
  createTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
  createSubtitle: { color: theme.muted, fontSize: 10, marginTop: 4 },
  fieldLabel: {
    color: theme.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 9,
    marginTop: 13,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    color: theme.text,
    backgroundColor: theme.bg,
    fontSize: 11,
  },
  descriptionInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: theme.text,
    backgroundColor: theme.bg,
    fontSize: 11,
    lineHeight: 18,
  },
  formActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  cancelEditButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  cancelEditText: { color: theme.muted, fontSize: 10, fontWeight: "700" },
  formColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 3,
  },
  formColumn: { flex: 1, minWidth: 205 },
  priorityGroup: { flexDirection: "row", gap: 7 },
  priorityButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingVertical: 11,
    backgroundColor: theme.bg,
  },
  prioritySelected: { backgroundColor: theme.raised },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { color: theme.muted, fontSize: 9, fontWeight: "700" },
  createFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 21,
  },
  formHint: { color: theme.dim, fontSize: 8, letterSpacing: 0.8 },
  addButton: {
    backgroundColor: theme.lime,
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.45 },
  addButtonText: { color: "#181B0E", fontSize: 10, fontWeight: "900" },
  error: { color: theme.red, fontSize: 11, lineHeight: 17, marginTop: 12 },

  taskCount: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  taskCountText: { color: theme.muted, fontSize: 8, letterSpacing: 0.7 },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    color: theme.text,
    backgroundColor: theme.surface,
    marginBottom: 12,
    fontSize: 11,
  },
  filterBar: { flexDirection: "row", gap: 7, marginBottom: 15 },
  filterButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: theme.surface,
  },
  filterButtonActive: { backgroundColor: theme.purpleBg, borderColor: "#62558D" },
  filterText: { color: theme.muted, fontSize: 10, fontWeight: "700" },
  filterTextActive: { color: theme.purple },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 43,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 13,
    backgroundColor: theme.surface,
  },
  emptySymbol: { color: theme.lime, fontSize: 26, marginBottom: 12 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  emptyDescription: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },

  taskList: { gap: 8 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 15,
  },
  taskIndex: { color: theme.dim, fontSize: 9, width: 17 },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 1,
    borderColor: "#535765",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: theme.purple, borderColor: theme.purple },
  checkmark: { color: "#101016", fontSize: 12, fontWeight: "900" },
  taskBody: { flex: 1, minWidth: 0 },
  taskTitle: { color: theme.text, fontSize: 12, fontWeight: "600", lineHeight: 19 },
  taskTitleDone: { color: theme.dim, textDecorationLine: "line-through" },
  taskDescription: {
    color: theme.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 7,
  },
  priorityBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  priorityBadgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  taskStatus: { color: theme.dim, fontSize: 8, letterSpacing: 0.4 },
  taskDue: { color: theme.muted, fontSize: 8 },
  editButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  editText: { color: theme.purple, fontSize: 9, fontWeight: "700" },
  deleteButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.raised,
  },
  deleteText: { color: theme.red, fontSize: 21, lineHeight: 23 },

  footer: {
    borderTopWidth: 1,
    borderColor: theme.border,
    marginTop: 43,
    paddingTop: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  footerBrand: { color: theme.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  footerNote: { color: theme.dim, fontSize: 8, letterSpacing: 1 },
});
