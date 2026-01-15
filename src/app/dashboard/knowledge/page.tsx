import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Upload } from "lucide-react"

export default function KnowledgePage() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
                    <p className="text-muted-foreground">Manage your FAQs and business policies.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Upload className="mr-2 h-4 w-4" /> Import CSV
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Question
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i}>
                        <CardHeader>
                            <CardTitle className="text-base">What are your operating hours?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                We are open Monday to Friday from 9am to 5pm, and weekends from 10am to 2pm.
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
