import { Elysia } from "elysia";

import { getConfig, updateConfig } from "../../../entities/config/api/config";
import { cn } from "../../../lib/utils";
import { htmlResponse, renderPage } from "../../layout";

type SettingsFormValues = {
  notesDir: string;
  fleeting: string;
  literature: string;
  permanent: string;
  structure: string;
  index: string;
};

type SettingsFieldKey = keyof SettingsFormValues;
type SettingsFieldErrors = Partial<Record<SettingsFieldKey, string>>;

type SettingsMessage = {
  type: "success" | "error";
  text: string;
};

type FormValue = string | Blob;

type FormDataLike = {
  get(name: string): FormValue | null;
};

const SETTINGS_FIELDS: ReadonlyArray<{
  key: SettingsFieldKey;
  label: string;
  description: string;
}> = [
  { key: "notesDir", label: "Notes Root", description: "ノートのルートディレクトリ" },
  { key: "fleeting", label: "Fleeting", description: "一時メモ" },
  { key: "literature", label: "Literature", description: "文献ノート" },
  { key: "permanent", label: "Permanent", description: "恒久ノート" },
  { key: "structure", label: "Structure", description: "構造ノート" },
  { key: "index", label: "Index", description: "索引ノート" },
];

const configToFormValues = (config: Awaited<ReturnType<typeof getConfig>>): SettingsFormValues => ({
  notesDir: config.notesDir,
  fleeting: config.zettelkasten.directories.fleeting,
  literature: config.zettelkasten.directories.literature,
  permanent: config.zettelkasten.directories.permanent,
  structure: config.zettelkasten.directories.structure,
  index: config.zettelkasten.directories.index,
});

const parseFormValue = (formData: FormDataLike, key: SettingsFieldKey): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const extractSettingsFormValues = (formData: FormDataLike): SettingsFormValues => ({
  notesDir: parseFormValue(formData, "notesDir"),
  fleeting: parseFormValue(formData, "fleeting"),
  literature: parseFormValue(formData, "literature"),
  permanent: parseFormValue(formData, "permanent"),
  structure: parseFormValue(formData, "structure"),
  index: parseFormValue(formData, "index"),
});

const validateSettingsFormValues = (values: SettingsFormValues): SettingsFieldErrors => {
  const errors: SettingsFieldErrors = {};
  for (const field of SETTINGS_FIELDS) {
    if (!values[field.key]) {
      errors[field.key] = "必須です。";
    }
  }

  const directoryFields: ReadonlyArray<SettingsFieldKey> = [
    "fleeting",
    "literature",
    "permanent",
    "structure",
    "index",
  ];
  const seen = new Set<string>();
  for (const field of directoryFields) {
    const value = values[field];
    if (!value) {
      continue;
    }
    if (seen.has(value)) {
      errors[field] = "重複しない値を指定してください。";
    }
    seen.add(value);
  }

  return errors;
};

const hasFieldErrors = (errors: SettingsFieldErrors): boolean => Object.keys(errors).length > 0;

const SettingsForm = ({
  values,
  errors,
  message,
}: {
  values: SettingsFormValues;
  errors?: SettingsFieldErrors;
  message?: SettingsMessage;
}): JSX.Element => (
  <section className="space-y-6 text-pretty">
    <h1 className="text-balance text-2xl font-semibold text-slate-900">設定</h1>
    <form method="post" action="/settings/directories" className="space-y-6">
      <section id="settings-directories" className="space-y-4 rounded-xl p-4">
        <div className="grid gap-4">
          {SETTINGS_FIELDS.map((field) => {
            const value = values[field.key];
            const error = errors?.[field.key];

            return (
              <label key={field.key} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">{field.label}</span>
                  <span className="text-xs text-slate-500">{field.description}</span>
                </div>
                <input
                  type="text"
                  name={field.key}
                  defaultValue={value}
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? `${field.key}-error` : undefined}
                  className={cn(
                    "h-10 w-full rounded-lg bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300",
                    error ? "bg-rose-50 focus:ring-rose-200" : "",
                  )}
                />
                {error ? (
                  <p id={`${field.key}-error`} className="text-xs text-rose-600">
                    {error}
                  </p>
                ) : null}
              </label>
            );
          })}
        </div>
      </section>
      <div className="mt-6 flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          設定を保存
        </button>
        {message ? (
          <p
            className={cn(
              "text-sm",
              message.type === "success" ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  </section>
);

/**
 * Settings directories page routes.
 */
export const createSettingsDirectoriesPageRoutes = () =>
  new Elysia()
    .get(
      "/settings",
      () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "/settings/directories",
          },
        }),
    )
    .get("/settings/directories", async ({ request }) => {
      const url = new URL(request.url);
      const config = await getConfig();

      return htmlResponse(
        renderPage("設定", url.pathname, <SettingsForm values={configToFormValues(config)} />),
      );
    })
    .post("/settings/directories", async ({ request }) => {
      const url = new URL(request.url);
      const formData = await request.formData();
      const values = extractSettingsFormValues(formData);
      const errors = validateSettingsFormValues(values);

      if (hasFieldErrors(errors)) {
        return htmlResponse(
          renderPage(
            "設定",
            url.pathname,
            <SettingsForm
              values={values}
              errors={errors}
              message={{ type: "error", text: "入力内容を確認してください。" }}
            />,
          ),
          400,
        );
      }

      try {
        const updated = await updateConfig({
          notesDir: values.notesDir,
          zettelkasten: {
            directories: {
              fleeting: values.fleeting,
              literature: values.literature,
              permanent: values.permanent,
              structure: values.structure,
              index: values.index,
            },
          },
        });

        return htmlResponse(
          renderPage(
            "設定",
            url.pathname,
            <SettingsForm
              values={configToFormValues(updated)}
              message={{ type: "success", text: "設定を保存しました。" }}
            />,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "設定の保存に失敗しました。";
        return htmlResponse(
          renderPage(
            "設定",
            url.pathname,
            <SettingsForm values={values} message={{ type: "error", text: message }} />,
          ),
          400,
        );
      }
    });
