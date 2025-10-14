import { z } from "zod";

export const visitSchema = z.object({
  store_id: z.string()
    .uuid({ message: "ID da loja inválido" }),
  visit_date: z.date({
    required_error: "Data da visita é obrigatória",
  }),
  scheduled_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { 
      message: "Horário inválido. Use formato HH:MM" 
    })
    .optional(),
  visit_type: z.enum(["routine", "special", "audit", "emergency"])
    .default("routine"),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"])
    .default("scheduled"),
  objectives: z.array(z.string().trim().max(200))
    .max(10, { message: "Máximo de 10 objetivos" })
    .optional(),
  notes: z.string()
    .trim()
    .max(2000, { message: "Observações devem ter no máximo 2000 caracteres" })
    .optional(),
  check_in_latitude: z.number()
    .min(-90)
    .max(90)
    .optional(),
  check_in_longitude: z.number()
    .min(-180)
    .max(180)
    .optional(),
  checklist_completed: z.boolean().default(false),
  photos_required: z.boolean().default(false),
  photos_taken: z.number()
    .int()
    .nonnegative()
    .default(0),
  duration_minutes: z.number()
    .int()
    .nonnegative()
    .max(480, { message: "Duração não pode exceder 8 horas" })
    .optional(),
});

export type VisitFormData = z.infer<typeof visitSchema>;
