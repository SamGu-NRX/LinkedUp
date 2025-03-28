import Image from "next/image"

const participants = [
  { id: 1, name: "You" },
  { id: 2, name: "John Doe" },
  { id: 3, name: "Jane Smith" },
  { id: 4, name: "Alice Johnson" },
]

export default function VideoGrid() {
  return (
    <div className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-auto">
      {participants.map((participant) => (
        <div key={participant.id} className="relative aspect-video bg-gray-700 rounded-lg overflow-hidden">
          <Image
            src={`/placeholder.svg?height=360&width=640&text=${participant.name}`}
            alt={participant.name}
            layout="fill"
            objectFit="cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">
            {participant.name}
          </div>
        </div>
      ))}
    </div>
  )
}

