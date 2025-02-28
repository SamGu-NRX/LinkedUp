import { StreamVideoClient, User } from "@stream-io/video-react-sdk";

interface SupabaseUser {
  user_id: string;
}

export function createStreamVideoClient(user: SupabaseUser) {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY as string;
  const token = process.env.STREAM_SECRET_KEY as string;

  const streamUser: User = {
    id: user.user_id,
  };

  return new StreamVideoClient({ apiKey, token, user: streamUser });
}
