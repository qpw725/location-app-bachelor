export type MyEventItem = {
  title: string;
  time: string;
  place: string;
  host: string;
  genre: string;
  visibility: "Public" | "Private";
};

export type DiscoverEventItem = {
  title: string;
  time: string;
  place: string;
  host: string;
  vibe: string;
};

export const attendingEvents: MyEventItem[] = [
  {
    title: "Friday Dinner",
    time: "Fri, 19:00",
    place: "Kobenhavn K",
    host: "Hosted by Freja",
    genre: "Social dining",
    visibility: "Private",
  },
  {
    title: "Board Game Night",
    time: "Sat, 20:30",
    place: "Norrebro",
    host: "Hosted by Emil",
    genre: "Games and drinks",
    visibility: "Public",
  },
];

export const hostingEvents: MyEventItem[] = [
  {
    title: "Pre-drinks at Ben's",
    time: "Thu, 18:00",
    place: "Frederiksberg",
    host: "Hosted by You",
    genre: "Night out warm-up",
    visibility: "Private",
  },
];

export const pastEvents: MyEventItem[] = [
  {
    title: "Brunch Meetup",
    time: "Sun, Feb 23",
    place: "Vesterbro",
    host: "Hosted by Anna",
    genre: "Brunch social",
    visibility: "Public",
  },
  {
    title: "Coffee Catch-up",
    time: "Wed, Feb 19",
    place: "City Center",
    host: "Hosted by Rasmus",
    genre: "Casual meetup",
    visibility: "Private",
  },
];

export const discoverEvents: DiscoverEventItem[] = [
  { title: "Sunset Harbor Walk", time: "Today, 18:30", place: "Islands Brygge", host: "Hosted by Freja", vibe: "Relaxed social" },
  { title: "Open Air Coffee Meetup", time: "Tomorrow, 11:00", place: "Kongens Have", host: "Hosted by Oliver", vibe: "Casual networking" },
  { title: "Student Trivia Night", time: "Thu, 20:00", place: "City Center", host: "Hosted by Mikkel", vibe: "Games and drinks" },
  { title: "Saturday Run Club", time: "Sat, 09:00", place: "Faelledparken", host: "Hosted by Sara", vibe: "Fitness group" },
];
