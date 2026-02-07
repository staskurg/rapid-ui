"use client";

import * as React from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { UISpec, Field } from "@/lib/spec/types";

interface FormModalProps {
  spec: UISpec;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  initialValues?: Record<string, unknown>;
  mode?: "create" | "edit";
}

export function FormModal({
  spec,
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  mode = "create",
}: FormModalProps) {
  // Generate Zod schema from spec
  const formSchema = React.useMemo(() => {
    const schemaObject: Record<string, z.ZodTypeAny> = {};

    spec.form.fields.forEach((fieldName) => {
      const field = spec.fields.find((f) => f.name === fieldName);
      if (!field) return;

      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case "string":
          fieldSchema = z.string();
          break;
        case "number":
          fieldSchema = z.number();
          break;
        case "boolean":
          fieldSchema = z.boolean();
          break;
        case "enum":
          fieldSchema = z.enum(
            (field.options || []) as [string, ...string[]]
          );
          break;
        default:
          fieldSchema = z.string();
      }

      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      }

      schemaObject[fieldName] = fieldSchema;
    });

    return z.object(schemaObject);
  }, [spec]);

  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: (initialValues as FormData | undefined) || ({} as FormData),
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        form.reset(initialValues);
      } else {
        form.reset();
      }
    }
  }, [isOpen, initialValues, form]);

  const handleSubmit = (data: FormData) => {
    onSubmit(data);
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `Create ${spec.entity}` : `Edit ${spec.entity}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Add a new ${spec.entity.toLowerCase()} to the system.`
              : `Update the ${spec.entity.toLowerCase()} information.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {spec.form.fields.map((fieldName) => {
            const field = spec.fields.find((f) => f.name === fieldName);
            if (!field) return null;

            return (
              <div key={fieldName} className="space-y-2">
                <Label htmlFor={fieldName}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderField(field, form)}
                {form.formState.errors[fieldName] && (
                  <p className="text-sm text-destructive">
                    {String(form.formState.errors[fieldName]?.message)}
                  </p>
                )}
              </div>
            );
          })}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {mode === "create" ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function renderField(field: Field, form: UseFormReturn<Record<string, unknown>>) {
  const fieldName = field.name;
  const value = form.watch(fieldName) as unknown;

  switch (field.type) {
    case "string":
      return (
        <Input
          id={fieldName}
          {...form.register(fieldName)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );
    case "number":
      return (
        <Input
          id={fieldName}
          type="number"
          {...form.register(fieldName, { valueAsNumber: true })}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={fieldName}
            checked={typeof value === "boolean" ? value : false}
            onCheckedChange={(checked) =>
              form.setValue(fieldName, checked, { shouldValidate: true })
            }
          />
          <Label htmlFor={fieldName} className="font-normal">
            {field.label}
          </Label>
        </div>
      );
    case "enum":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(val) =>
            form.setValue(fieldName, val, { shouldValidate: true })
          }
        >
          <SelectTrigger id={fieldName}>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input
          id={fieldName}
          {...form.register(fieldName)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );
  }
}
