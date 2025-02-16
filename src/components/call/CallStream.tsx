"use client";

import { createClient } from "@/utils/supabase/server";
import { CallState, useConnectedUser, useStreamVideoClient, Call } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/lib/hooks/use-toast";

const Meeting = async () => {
    const router = useRouter();
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
        console.error(error);
    }

    const client = useStreamVideoClient();
    const [values, setValues] = useState({
        dateTime: new Date(),
        description: "",
        link: ""
    })
    const [callDetails, setCallDetails] = useState<Call>()
    const { toast } = useToast()

    const createMeeting = async () => {
        if(!client || !data?.user) return;
        try {
            if(!values.dateTime) {
                toast({ title: "Please select a date and time"})
                return;
            }
            const id = crypto.randomUUID();
            const call = client.call("default", id);

            if(!call) throw new Error("Failed to create call");

            const startsAt = values.dateTime.toISOString() ||
            new Date(Date.now()).toISOString();
            const description = "Instant Meeting";

            await call.getOrCreate({
                data:{
                    starts_at: startsAt,
                    custom: {
                        description
                    }
                }
            })

            call.camera.disable(); // TODO - check
            setCallDetails(call);

            if(!values.description) {
                router.push('/app/meeting/${call.id}') // TODO
            }

            toast({ title: "Meeting Created" })
        } catch (error) {
            console.log(error);
            toast({
                title: "Failed to create meeting",
                description: '${Date(Date.now())}'
            })
        }
    }

}
