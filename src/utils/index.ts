export function toPusherKey(key: string) {
  return key.replace(/:/g, '__')
}

export function chatHrefConstructor(id1: string, id2: string) {
  const sortedIds = [id1, id2].sort()
  return `${sortedIds[0]}--${sortedIds[1]}`
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}


// TODO: Make this, add a link, link to modal
// export const CTALink = ({ href, children }) => {
//   return (
//     <a href={href} target="_blank" rel="noopener noreferrer">
//       {children}
//     </a>
//   );
// };
