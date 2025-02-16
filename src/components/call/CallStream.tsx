"use client";

import { CallState, useConnectedUser, useStreamVideoClient, Call } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs"; // TODO

const Meeting = () => {
    const router = useRouter();
    const { user } = useUser();
    const client = useStreamVideoClient();
    const [values, setValues] = useState({
        dateTime: new Date(),
        description: "",
        link: ""
    })
    const [callDetails, setCallDetails] = useState<Call>()
    
    const createMeeting = async () => {
        if(!client || !user) return;
        try {
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

            setCallDetails(call);
            if(!values.description) {
                router.push('/meeting/${call.id}') // TODO
            }
        } catch (error) {
            console.log(error);
        }
    }

}