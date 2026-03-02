import { ScrollView, View, Text, StyleSheet } from "react-native";

type EventItem = {
  title: string;
  time: string;
  place: string;
};

const attendingEvents: EventItem[] = [
  { title: "Friday Dinner", time: "Fri, 19:00", place: "Kobenhavn K" },
  { title: "Board Game Night", time: "Sat, 20:30", place: "Norrebro" },
];

const hostingEvents: EventItem[] = [
  { title: "Pre-drinks at Ben's", time: "Thu, 18:00", place: "Frederiksberg" },
];

const pastEvents: EventItem[] = [
  { title: "Brunch Meetup", time: "Sun, Feb 23", place: "Vesterbro" },
  { title: "Coffee Catch-up", time: "Wed, Feb 19", place: "City Center" },
];

function EventCard({ title, time, place }: EventItem) {
  return (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
    </View>
  );
}

function EventSection({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: EventItem[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        items.map((item) => <EventCard key={`${title}-${item.title}`} {...item} />)
      )}
    </View>
  );
}

export default function EventsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>EVENTS</Text>
        <Text style={styles.heroTitle}>My Events</Text>
        <Text style={styles.heroSubtitle}>All placeholder content for now.</Text>
      </View>

      <EventSection
        title="Attending"
        emptyText="You are not attending any events yet."
        items={attendingEvents}
      />
      <EventSection title="Hosting" emptyText="You are not hosting any events yet." items={hostingEvents} />
      <EventSection title="Past" emptyText="No past events yet." items={pastEvents} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  hero: {
    backgroundColor: "#10264a",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  heroEyebrow: {
    color: "#9fb7db",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { color: "#ffffff", fontSize: 28, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { color: "#d7e3f6", fontSize: 14 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1a2233", marginBottom: 10 },
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginBottom: 10,
  },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#1a2233", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: "#5d6a80" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
  },
  emptyText: { fontSize: 14, color: "#5d6a80" },
});
