import Category from "@/models/Category";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CategoryFormDialog from "@/components/dashboard/admin/CategoryFormDialog";
import DeleteCategoryButton from "@/components/dashboard/admin/DeleteCategoryButton";

export default async function AdminCategoriesPage() {
    const categories = await Category.find({}).sort({ title: 1 }).lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Categories</h1>
                    <p className="mt-2 text-muted-foreground">Every category posts can be filed under.</p>
                </div>
                <CategoryFormDialog />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Title</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={String(category._id)}>
                                <TableCell className="font-medium">{category.title}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <CategoryFormDialog category={{ id: String(category._id), title: category.title }} />
                                        <DeleteCategoryButton id={String(category._id)} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
