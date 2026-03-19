import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { CheckCircle2, RefreshCw } from "lucide-react"

export default function CalendarPage() {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Calendar Integration</h2>
                <p className="text-muted-foreground">Manage your calendar connections.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Calendars</CardTitle>
                    <CardDescription>
                        AutoLeap syncs with these calendars to check availability.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between bg-muted/40 p-4 rounded-xl">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                G
                            </div>
                            <div>
                                <div className="font-medium">Google Calendar</div>
                                <div className="text-sm text-muted-foreground">primary@gmail.com</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Connected</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sync Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="font-medium">Sync Frequency</div>
                            <div className="text-sm text-muted-foreground">How often we check for new events.</div>
                        </div>
                        <Button variant="outline" size="sm">
                            <RefreshCw className="mr-2 h-4 w-4" /> Force Sync
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
