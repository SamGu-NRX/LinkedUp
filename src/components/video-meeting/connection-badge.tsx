import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConnectionStatus, CONNECTION_STATUS_CONFIG } from "@/types/meeting";

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
  latency: number;
  name: string;
}

export function ConnectionBadge({ status, latency, name }: ConnectionBadgeProps) {
  const config = CONNECTION_STATUS_CONFIG[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${config.color}`} />
            <span className="text-white text-sm truncate">{name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            {config.label} ({latency}ms)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

