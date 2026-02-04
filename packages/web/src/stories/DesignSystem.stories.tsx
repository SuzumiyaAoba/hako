import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const DesignSystemCanvas = (): JSX.Element => (
  <div className="min-h-dvh bg-[repeating-linear-gradient(to_bottom,#f7f3ed_0px,#f7f3ed_36px,#d5e3ff_36px,#d5e3ff_37px)] px-6 py-10">
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <Card className="border-2 border-slate-900 bg-white">
        <CardHeader>
          <Badge variant="secondary" className="mb-3 w-fit border border-slate-900">
            Forms
          </Badge>
          <CardTitle>入力コンポーネント</CardTitle>
          <CardDescription>角丸なしのフォーム部品をまとめたサンプルです。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">タイトル</Label>
            <Input id="name" defaultValue="Zettelkasten weekly" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">カテゴリ</Label>
            <Select id="category" defaultValue="research">
              <option value="research">Research</option>
              <option value="daily">Daily</option>
              <option value="idea">Idea</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">本文</Label>
            <Textarea id="body" defaultValue="ノートの本文をここに入力します。" />
          </div>
          <div className="grid gap-2">
            <Label>公開設定</Label>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox defaultChecked aria-label="公開設定: 公開" />
                公開
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox aria-label="公開設定: 下書き" />
                下書き
              </label>
            </div>
          </div>
          <RadioGroup className="grid gap-2" aria-label="優先度">
            <Label>優先度</Label>
            <label className="inline-flex items-center gap-2 text-sm">
              <RadioItem name="priority" defaultChecked aria-label="優先度: 高" />高
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <RadioItem name="priority" aria-label="優先度: 通常" />
              通常
            </label>
          </RadioGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button>保存</Button>
          <Button variant="outline">下書き</Button>
          <Button variant="ghost">キャンセル</Button>
        </CardFooter>
      </Card>

      <Card className="border-2 border-slate-900 bg-white">
        <CardHeader>
          <Badge variant="outline" className="mb-3 w-fit border border-slate-900">
            Feedback
          </Badge>
          <CardTitle>状態表示</CardTitle>
          <CardDescription>通知やローディングに使う表示コンポーネントです。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>保存完了</AlertTitle>
            <AlertDescription>ノートを更新しました。公開リストにも反映済みです。</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>同期エラー</AlertTitle>
            <AlertDescription>ネットワーク接続を確認して再実行してください。</AlertDescription>
          </Alert>
          <Separator />
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-900 bg-white lg:col-span-2">
        <CardHeader>
          <Badge variant="secondary" className="mb-3 w-fit border border-slate-900">
            Data
          </Badge>
          <CardTitle>テーブル</CardTitle>
          <CardDescription>一覧・管理画面向けの基本テーブルです。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>最近更新したノート</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>タグ</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="text-right">状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Hono SSR メモ</TableCell>
                <TableCell>#bun</TableCell>
                <TableCell className="tabular-nums">2026-02-04</TableCell>
                <TableCell className="text-right">公開</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Shiki 設計ノート</TableCell>
                <TableCell>#frontend</TableCell>
                <TableCell className="tabular-nums">2026-02-03</TableCell>
                <TableCell className="text-right">下書き</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </div>
);

const meta = {
  title: "Design System/Overview",
  component: DesignSystemCanvas,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DesignSystemCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
