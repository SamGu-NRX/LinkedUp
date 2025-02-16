import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const AfterCallScreen = () => {
  const meetingSummary = {
    duration: "25 minutes",
    participant: "Sarah Chen",
    topics: ["Photography", "Sustainable Design", "Tech Innovation"],
    keyPoints: [
      "Discussed the intersection of photography and sustainable design",
      "Explored potential collaborations in tech startups",
      "Shared experiences on balancing creativity and business aspects",
      "Identified common challenges in respective industries",
    ],
    nextSteps: [
      "Schedule follow-up meeting in 2 weeks",
      "Share resources on sustainable photography techniques",
      "Introduce Sarah to potential collaborators in tech startup space",
    ],
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Meeting Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Meeting Details</h3>
              <p>
                <strong>Duration:</strong> {meetingSummary.duration}
              </p>
              <p>
                <strong>Participant:</strong> {meetingSummary.participant}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Topics Discussed</h3>
              <ul className="list-disc pl-5">
                {meetingSummary.topics.map((topic, index) => (
                  <li key={index}>{topic}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Key Points</h3>
              <ScrollArea className="h-40">
                <ul className="list-disc pl-5">
                  {meetingSummary.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Next Steps</h3>
              <ul className="list-disc pl-5">
                {meetingSummary.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Button variant="default" size="lg">
              Download Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AfterCallScreen

