// data/profiles.ts
import { Profile } from "@/types/profile";

/**
 * Generate a consistent unique avatar identifier
 * This will be used with our avatar utility to generate consistent gradients
 */
const generateAvatarId = (name: string): string => {
  return name.toLowerCase().replace(/\s+/g, "-");
};

export const profiles: Profile[] = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar: generateAvatarId("Alice Johnson"),
    status: "online",
    lastCallDate: "2023-05-15",
    bio: "Passionate about AI and machine learning",
    profession: "Data Scientist",
    company: "TechCorp",
    school: "MIT",
    experience: 5,
    sharedInterests: [
      { type: "academic", name: "Machine Learning" },
      { type: "industry", name: "AI" },
      { type: "skill", name: "Python" },
    ],
    connectionType: "collaboration",
  },
  {
    id: "2",
    name: "Bob Smith",
    avatar: generateAvatarId("Bob Smith"),
    status: "away",
    lastCallDate: "2023-05-14",
    bio: "Experienced software engineer with a focus on web technologies",
    profession: "Senior Software Engineer",
    company: "WebSolutions Inc.",
    school: "Stanford University",
    experience: 8,
    sharedInterests: [
      { type: "academic", name: "Web Development" },
      { type: "industry", name: "E-commerce" },
      { type: "skill", name: "JavaScript" },
    ],
    connectionType: "mentorship",
  },
  {
    id: "3",
    name: "Charlie Brown",
    avatar: generateAvatarId("Charlie Brown"),
    status: "offline",
    lastCallDate: "2023-05-13",
    bio: "Entrepreneur and startup enthusiast",
    profession: "Founder & CEO",
    company: "InnovateTech",
    school: "Harvard Business School",
    experience: 10,
    sharedInterests: [
      { type: "academic", name: "Entrepreneurship" },
      { type: "industry", name: "Startups" },
      { type: "skill", name: "Business Strategy" },
    ],
    connectionType: "b2b",
  },
  {
    id: "4",
    name: "Diana Prince",
    avatar: generateAvatarId("Diana Prince"),
    status: "online",
    lastCallDate: "2023-05-12",
    bio: "UX/UI designer with a passion for creating intuitive user experiences",
    profession: "Lead UX Designer",
    company: "DesignMasters",
    school: "Rhode Island School of Design",
    experience: 7,
    sharedInterests: [
      { type: "academic", name: "User Experience" },
      { type: "industry", name: "Product Design" },
      { type: "skill", name: "Figma" },
    ],
    connectionType: "collaboration",
  },
];

// Initial messages data structure
export const initialMessages: Record<
  string,
  Array<{
    id: string;
    content: string;
    senderId: string;
    timestamp: number;
  }>
> = {
  "1": [
    {
      id: "1",
      content: "Hey! How are you?",
      senderId: "1",
      timestamp: Date.now() - 3000,
    },
    {
      id: "2",
      content: "I am good, thanks!",
      senderId: "user",
      timestamp: Date.now() - 2000,
    },
  ],
  "2": [
    {
      id: "3",
      content: "Did you see the latest update?",
      senderId: "2",
      timestamp: Date.now() - 1000,
    },
  ],
  "3": [
    {
      id: "4",
      content: "Meeting at 3pm tomorrow?",
      senderId: "3",
      timestamp: Date.now(),
    },
  ],
  "4": [],
};
