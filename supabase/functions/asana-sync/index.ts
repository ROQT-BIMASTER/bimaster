import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ASANA_API = "https://app.asana.com/api/1.0";

// Concurrency limiter to avoid overwhelming APIs
function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let active = 0;
  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const fn = queue.shift()!;
      fn();
    }
  }
  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => { active--; next(); });
      });
      next();
    });
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Token inválido" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { path, pat, workspace_gid, project_gids } = body;

    const asanaPat = pat || Deno.env.get("ASANA_PAT");
    if (!asanaPat && path !== "/status") {
      return json({ error: "Token do Asana não configurado" }, 400);
    }

    switch (path) {
      case "/test-connection": {
        const res = await asanaGet("/users/me", asanaPat);
        const workspaces = await asanaGet("/workspaces", asanaPat);
        return json({
          user: { name: res.data.name, email: res.data.email },
          workspaces: workspaces.data.map((w: any) => ({ gid: w.gid, name: w.name })),
        });
      }

      case "/list-projects": {
        if (!workspace_gid) return json({ error: "workspace_gid obrigatório" }, 400);
        const projects = await asanaGetAll(`/workspaces/${workspace_gid}/projects`, asanaPat, {
          opt_fields: "name,color,archived,created_at,modified_at,current_status",
        });
        return json({
          projects: projects
            .filter((p: any) => !p.archived)
            .map((p: any) => ({
              gid: p.gid,
              name: p.name,
              color: p.color,
              modified_at: p.modified_at,
            })),
        });
      }

      case "/sync-project": {
        if (!workspace_gid || !project_gids?.length) {
          return json({ error: "workspace_gid e project_gids obrigatórios" }, 400);
        }

        const { data: logRow } = await adminClient
          .from("asana_sync_log")
          .insert({
            workspace_gid,
            project_gids,
            status: "running",
            started_by: userId,
          })
          .select()
          .single();

        const logId = logRow!.id;
        const errors: any[] = [];
        let projectsSynced = 0, sectionsSynced = 0, tasksSynced = 0, commentsSynced = 0;
        let usersMapped = 0, collaboratorsSynced = 0, subtasksSynced = 0, attachmentsSynced = 0;
        const limit = pLimit(5); // Max 5 concurrent operations

        try {
          // ===== MAP ASANA USERS =====
          const asanaUsers = await asanaGetAll(`/workspaces/${workspace_gid}/users`, asanaPat, {
            opt_fields: "name,email",
          });
          const { data: profiles } = await adminClient.from("profiles").select("id, email, nome");
          const userMap = new Map<string, string>();

          // Batch-load existing user mappings
          const userGids = asanaUsers.filter((u: any) => u.gid).map((u: any) => u.gid);
          const { data: existingUserMappings } = await adminClient
            .from("asana_sync_mappings")
            .select("asana_gid, local_id")
            .eq("entity_type", "user")
            .in("asana_gid", userGids.length ? userGids : ["__none__"]);

          const existingUserMap = new Map((existingUserMappings || []).map((m: any) => [m.asana_gid, m.local_id]));

          for (const au of asanaUsers) {
            if (!au.email) continue;

            // Check existing mapping first (fastest path)
            const existingLocal = existingUserMap.get(au.gid);
            if (existingLocal) {
              userMap.set(au.gid, existingLocal);
              usersMapped++;
              continue;
            }

            const match = (profiles || []).find(
              (p: any) => p.email?.toLowerCase() === au.email.toLowerCase()
            );
            if (match) {
              userMap.set(au.gid, match.id);
              usersMapped++;
            } else {
              try {
                const randomPwd = crypto.randomUUID() + "Aa1!";
                const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
                  email: au.email,
                  password: randomPwd,
                  email_confirm: true,
                  user_metadata: { nome: au.name || au.email, origem: "asana" },
                });

                if (authErr || !authUser?.user) {
                  errors.push({ user: au.email, error: `Auto-create auth falhou: ${authErr?.message}` });
                  continue;
                }

                await adminClient.from("profiles").update({
                  nome: au.name || au.email,
                  aprovado: false,
                  status: "importado_asana",
                }).eq("id", authUser.user.id);

                await adminClient.from("asana_sync_mappings").insert({
                  asana_gid: au.gid,
                  entity_type: "user",
                  local_id: authUser.user.id,
                  workspace_gid,
                });

                userMap.set(au.gid, authUser.user.id);
                usersMapped++;
                console.log(`Criado profile para ${au.name} (${au.email})`);
              } catch (createErr: any) {
                errors.push({ user: au.email, error: `Auto-create falhou: ${createErr.message}` });
              }
            }
          }
          console.log(`[users] ${usersMapped} usuários mapeados`);

          for (const projectGid of project_gids) {
            try {
              const proj = await asanaGet(`/projects/${projectGid}`, asanaPat, {
                opt_fields: "name,color,notes,created_at,modified_at",
              });

              // Upsert project
              const { data: existingProj } = await adminClient
                .from("projetos")
                .select("id")
                .eq("asana_gid", projectGid)
                .maybeSingle();

              let localProjectId: string;
              if (existingProj) {
                localProjectId = existingProj.id;
                await adminClient.from("projetos").update({
                  nome: proj.data.name,
                  descricao: proj.data.notes || null,
                  updated_at: new Date().toISOString(),
                }).eq("id", localProjectId);
              } else {
                const { data: newProj } = await adminClient.from("projetos").insert({
                  nome: proj.data.name,
                  descricao: proj.data.notes || null,
                  cor: mapAsanaColor(proj.data.color),
                  criador_id: userId,
                  tipo: "kanban",
                  status: "ativo",
                  asana_gid: projectGid,
                  origem_projeto: "asana",
                }).select().single();
                localProjectId = newProj!.id;
              }
              projectsSynced++;

              // ===== SYNC SECTIONS =====
              const sections = await asanaGetAll(`/projects/${projectGid}/sections`, asanaPat, {
                opt_fields: "name,created_at",
              });

              const sectionMap = new Map<string, string>();
              for (let i = 0; i < sections.length; i++) {
                const sec = sections[i];
                const { data: existingSec } = await adminClient
                  .from("projeto_secoes")
                  .select("id")
                  .eq("asana_gid", sec.gid)
                  .eq("projeto_id", localProjectId)
                  .maybeSingle();

                if (existingSec) {
                  sectionMap.set(sec.gid, existingSec.id);
                  await adminClient.from("projeto_secoes").update({
                    nome: sec.name || "(Sem título)",
                    ordem: i,
                  }).eq("id", existingSec.id);
                } else {
                  const { data: newSec } = await adminClient.from("projeto_secoes").insert({
                    projeto_id: localProjectId,
                    nome: sec.name || "(Sem título)",
                    ordem: i,
                    asana_gid: sec.gid,
                  }).select().single();
                  sectionMap.set(sec.gid, newSec!.id);
                }
                sectionsSynced++;
              }

              const defaultSectionId = sectionMap.values().next().value;
              if (!defaultSectionId) {
                errors.push({ project: projectGid, error: "Nenhuma seção encontrada" });
                continue;
              }

              // ===== SYNC TASKS =====
              const tasks = await asanaGetAll(`/projects/${projectGid}/tasks`, asanaPat, {
                opt_fields: "name,notes,completed,completed_at,due_on,start_on,assignee,assignee.email,assignee.gid,memberships.section,parent,created_at,modified_at,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name,followers,followers.gid,followers.email,followers.name,tags,tags.name,tags.color,dependencies,dependencies.gid",
              });

              // Batch-load existing tasks by asana_gid
              const taskGids = tasks.map((t: any) => t.gid);
              const { data: existingTasks } = await adminClient
                .from("projeto_tarefas")
                .select("id, asana_gid")
                .in("asana_gid", taskGids.length ? taskGids : ["__none__"]);
              const existingTaskMap = new Map((existingTasks || []).map((t: any) => [t.asana_gid, t.id]));

              const taskMap = new Map<string, string>();

              // First pass: create/update tasks
              for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                const sectionGid = task.memberships?.[0]?.section?.gid;
                const sectionId = sectionGid ? sectionMap.get(sectionGid) : defaultSectionId;
                const assigneeId = task.assignee?.gid ? userMap.get(task.assignee.gid) : null;

                const cfMap = new Map<string, string>();
                for (const cf of (task.custom_fields || [])) {
                  const val = cf.enum_value?.name || cf.display_value || null;
                  if (cf.name && val) cfMap.set(cf.name.toLowerCase().trim(), val);
                }

                const asanaStatus = cfMap.get("status") || cfMap.get("estágio") || null;
                const status = task.completed ? "concluida" : mapAsanaStatus(asanaStatus);
                const prioridade = mapAsanaPriority(cfMap.get("prioridade") || cfMap.get("priority") || null);
                const estagio = cfMap.get("estágio") || cfMap.get("stage") || null;

                const camposCustomizados: Record<string, any> = {};
                for (const cf of (task.custom_fields || [])) {
                  if (cf.name) {
                    camposCustomizados[cf.name] = cf.enum_value?.name || cf.display_value || null;
                  }
                }

                const taskData: Record<string, any> = {
                  titulo: task.name || "(Sem título)",
                  descricao: task.notes || null,
                  status,
                  prioridade,
                  estagio,
                  codigo_acom: cfMap.get("acom") || null,
                  campos_customizados: camposCustomizados,
                  asana_json_raw: task,
                  data_prazo: task.due_on || null,
                  data_inicio: task.start_on || null,
                  data_conclusao: task.completed_at || null,
                  responsavel_id: assigneeId || null,
                  ordem: i,
                  asana_gid: task.gid,
                };

                const existingId = existingTaskMap.get(task.gid);
                let localTaskId: string;

                if (existingId) {
                  localTaskId = existingId;
                  taskMap.set(task.gid, localTaskId);
                  await adminClient.from("projeto_tarefas").update(taskData).eq("id", localTaskId);
                } else {
                  const { data: newTask, error: insertErr } = await adminClient.from("projeto_tarefas").insert({
                    ...taskData,
                    projeto_id: localProjectId,
                    secao_id: sectionId || defaultSectionId,
                    criador_id: userId,
                  }).select().single();
                  if (insertErr || !newTask) {
                    errors.push({ task: task.gid, error: `Insert falhou: ${insertErr?.message}` });
                    continue;
                  }
                  localTaskId = newTask.id;
                  taskMap.set(task.gid, localTaskId);
                }
                tasksSynced++;

                // Inline: sync followers (no fallback - bulk already works per logs)
                const followers = task.followers || [];
                for (const follower of followers) {
                  const localUserId = follower.gid ? userMap.get(follower.gid) : null;
                  if (!localUserId) continue;
                  await adminClient
                    .from("projeto_tarefa_colaboradores")
                    .upsert(
                      { tarefa_id: localTaskId, user_id: localUserId },
                      { onConflict: "tarefa_id,user_id", ignoreDuplicates: true }
                    );
                  collaboratorsSynced++;
                }

                // Inline: sync tags
                if (task.tags?.length) {
                  for (const tag of task.tags) {
                    if (!tag.gid) continue;
                    const { data: existingTag } = await adminClient
                      .from("projeto_tags")
                      .select("id")
                      .eq("asana_gid", tag.gid)
                      .maybeSingle();
                    let tagId: string;
                    if (existingTag) {
                      tagId = existingTag.id;
                    } else {
                      const { data: newTag } = await adminClient
                        .from("projeto_tags")
                        .insert({ nome: tag.name || "tag", cor: tag.color || null, asana_gid: tag.gid })
                        .select("id")
                        .single();
                      if (!newTag) continue;
                      tagId = newTag.id;
                    }
                    await adminClient
                      .from("projeto_tarefa_tags")
                      .upsert({ tarefa_id: localTaskId, tag_id: tagId }, { onConflict: "tarefa_id,tag_id" });
                  }
                }

                // Inline: sync dependencies
                if (task.dependencies?.length) {
                  for (const dep of task.dependencies) {
                    const depLocalId = taskMap.get(dep.gid);
                    if (depLocalId) {
                      await adminClient
                        .from("projeto_tarefa_dependencias")
                        .upsert(
                          { tarefa_id: localTaskId, depende_de_id: depLocalId, tipo: "blocked_by" },
                          { onConflict: "tarefa_id,depende_de_id" }
                        );
                    }
                  }
                }
              }

              // Second pass: link parent tasks
              for (const task of tasks) {
                if (task.parent?.gid && taskMap.has(task.gid) && taskMap.has(task.parent.gid)) {
                  await adminClient.from("projeto_tarefas").update({
                    parent_tarefa_id: taskMap.get(task.parent.gid),
                  }).eq("id", taskMap.get(task.gid));
                }
              }

              console.log(`[tasks] ${tasksSynced} tarefas sincronizadas. Iniciando subtarefas/anexos/comentários em paralelo...`);

              // ===== PARALLEL: Subtasks + Attachments + Comments =====
              // Process each task's secondary data with concurrency limit
              const secondaryOps: Promise<void>[] = [];

              for (const task of tasks) {
                const localTaskId = taskMap.get(task.gid);
                if (!localTaskId) continue;

                // Subtasks (recursive, depth 1-3)
                secondaryOps.push(limit(async () => {
                  await syncSubtasks(task.gid, localTaskId, 1);
                }));

                // Attachments
                secondaryOps.push(limit(async () => {
                  try {
                    const attachments = await asanaGetAll(`/tasks/${task.gid}/attachments`, asanaPat, {
                      opt_fields: "name,download_url,host,view_url,size,created_at",
                    });
                    for (const att of attachments) {
                      if (!att.gid) continue;
                      const { data: ea } = await adminClient.from("projeto_tarefa_anexos").select("id").eq("asana_gid", att.gid).maybeSingle();
                      if (!ea) {
                        const { error: aErr } = await adminClient.from("projeto_tarefa_anexos").insert({
                          tarefa_id: localTaskId,
                          nome: att.name || "attachment",
                          storage_path: att.download_url || att.view_url || "",
                          tipo_arquivo: att.host === "asana" ? "asana_hosted" : "external_link",
                          tamanho: att.size || null,
                          asana_gid: att.gid,
                          user_id: userId,
                        });
                        if (!aErr) attachmentsSynced++;
                      }
                    }
                  } catch (e: any) {
                    errors.push({ task: task.gid, error: `Anexos: ${e.message}` });
                  }
                }));

                // Comments + System Stories
                secondaryOps.push(limit(async () => {
                  try {
                    const stories = await asanaGetAll(`/tasks/${task.gid}/stories`, asanaPat, {
                      opt_fields: "gid,text,html_text,type,resource_subtype,created_by,created_at",
                    });

                    for (const story of stories) {
                      const isComment = story.type === "comment" || story.resource_subtype === "comment_added";
                      if (isComment && story.text) {
                        const authorId = story.created_by?.gid ? userMap.get(story.created_by.gid) || userId : userId;
                        const { data: existing } = await adminClient
                          .from("asana_sync_mappings")
                          .select("local_id")
                          .eq("asana_gid", story.gid)
                          .eq("entity_type", "comment")
                          .maybeSingle();

                        if (!existing) {
                          const { data: newComment } = await adminClient
                            .from("projeto_tarefa_comentarios")
                            .insert({ tarefa_id: localTaskId, user_id: authorId, conteudo: story.text })
                            .select()
                            .single();
                          if (newComment) {
                            await adminClient.from("asana_sync_mappings").insert({
                              asana_gid: story.gid, entity_type: "comment", local_id: newComment.id, workspace_gid,
                            });
                            commentsSynced++;
                          }
                        }
                      } else if ((story.type === "system" || story.resource_subtype) && story.text) {
                        // System activity
                        const { data: existingAct } = await adminClient
                          .from("asana_sync_mappings")
                          .select("local_id")
                          .eq("asana_gid", story.gid)
                          .eq("entity_type", "activity")
                          .maybeSingle();
                        if (existingAct) continue;

                        const actAuthorId = story.created_by?.gid ? userMap.get(story.created_by.gid) || userId : userId;
                        const mapping = subtypeToLocal(story.resource_subtype);
                        let valorNovo: string | null = null;
                        const paraMatch = story.text.match(/(?:para|to)\s+["""]?(.+?)["""]?\s*$/i);
                        if (paraMatch) valorNovo = paraMatch[1].trim();

                        const { data: newAct } = await adminClient
                          .from("projeto_tarefa_atividades")
                          .insert({
                            tarefa_id: localTaskId,
                            projeto_id: localProjectId,
                            user_id: actAuthorId,
                            tipo: mapping.tipo,
                            campo: mapping.campo,
                            valor_novo: valorNovo,
                            descricao: story.text,
                            created_at: story.created_at || new Date().toISOString(),
                          })
                          .select("id")
                          .single();

                        if (newAct) {
                          await adminClient.from("asana_sync_mappings").insert({
                            asana_gid: story.gid, entity_type: "activity", local_id: newAct.id, workspace_gid,
                          });
                        }
                      }
                    }
                  } catch (e: any) {
                    errors.push({ task: task.gid, error: `Stories: ${e.message}` });
                  }
                }));
              }

              // Wait for all secondary operations with a safety timeout
              await Promise.all(secondaryOps);
              console.log(`[done] Subtarefas: ${subtasksSynced}, Anexos: ${attachmentsSynced}, Comentários: ${commentsSynced}`);

              // ===== SUBTASK HELPER (closure) =====
              async function syncSubtasks(parentAsanaGid: string, parentLocalId: string, depth: number) {
                if (depth > 3) return;
                try {
                  const subtasks = await asanaGetAll(`/tasks/${parentAsanaGid}/subtasks`, asanaPat, {
                    opt_fields: "name,notes,completed,completed_at,due_on,start_on,assignee,assignee.gid,assignee.email,created_at,modified_at,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name",
                  });
                  for (let si = 0; si < subtasks.length; si++) {
                    const sub = subtasks[si];
                    const assigneeId = sub.assignee?.gid ? userMap.get(sub.assignee.gid) : null;

                    const cfMap = new Map<string, string>();
                    for (const cf of (sub.custom_fields || [])) {
                      const val = cf.enum_value?.name || cf.display_value || null;
                      if (cf.name && val) cfMap.set(cf.name.toLowerCase().trim(), val);
                    }

                    const asanaStatus = cfMap.get("status") || cfMap.get("estágio") || null;
                    const status = sub.completed ? "concluida" : mapAsanaStatus(asanaStatus);
                    const prioridade = mapAsanaPriority(cfMap.get("prioridade") || cfMap.get("priority") || null);

                    const subData: Record<string, any> = {
                      titulo: sub.name || "(Sem título)",
                      descricao: sub.notes || null,
                      status,
                      prioridade,
                      data_prazo: sub.due_on || null,
                      data_inicio: sub.start_on || null,
                      data_conclusao: sub.completed_at || null,
                      responsavel_id: assigneeId || null,
                      ordem: si,
                      asana_gid: sub.gid,
                      parent_tarefa_id: parentLocalId,
                    };

                    const { data: existingSub } = await adminClient
                      .from("projeto_tarefas")
                      .select("id")
                      .eq("asana_gid", sub.gid)
                      .maybeSingle();

                    let localSubId: string;
                    if (existingSub) {
                      localSubId = existingSub.id;
                      await adminClient.from("projeto_tarefas").update(subData).eq("id", localSubId);
                    } else {
                      const { data: newSub, error: subErr } = await adminClient.from("projeto_tarefas").insert({
                        ...subData,
                        projeto_id: localProjectId,
                        secao_id: defaultSectionId,
                        criador_id: userId,
                      }).select().single();
                      if (subErr || !newSub) {
                        errors.push({ subtask: sub.gid, error: `Subtask: ${subErr?.message}` });
                        continue;
                      }
                      localSubId = newSub.id;
                    }
                    taskMap.set(sub.gid, localSubId);
                    subtasksSynced++;

                    // Subtask attachments
                    try {
                      const subAtts = await asanaGetAll(`/tasks/${sub.gid}/attachments`, asanaPat, {
                        opt_fields: "name,download_url,host,view_url,size,created_at",
                      });
                      for (const att of subAtts) {
                        if (!att.gid) continue;
                        const { data: ea } = await adminClient.from("projeto_tarefa_anexos").select("id").eq("asana_gid", att.gid).maybeSingle();
                        if (!ea) {
                          const { error: aErr } = await adminClient.from("projeto_tarefa_anexos").insert({
                            tarefa_id: localSubId,
                            nome: att.name || "attachment",
                            storage_path: att.download_url || att.view_url || "",
                            tipo_arquivo: att.host === "asana" ? "asana_hosted" : "external_link",
                            tamanho: att.size || null,
                            asana_gid: att.gid,
                            user_id: userId,
                          });
                          if (!aErr) attachmentsSynced++;
                        }
                      }
                    } catch (_) { /* skip */ }

                    await syncSubtasks(sub.gid, localSubId, depth + 1);
                  }
                } catch (e: any) {
                  console.warn(`[subtasks] Erro depth=${depth} parent=${parentAsanaGid}:`, e.message);
                }
              }

            } catch (e: any) {
              errors.push({ project: projectGid, error: e.message });
            }
          }

          await adminClient.from("asana_sync_log").update({
            status: "completed",
            projects_synced: projectsSynced,
            sections_synced: sectionsSynced,
            tasks_synced: tasksSynced,
            comments_synced: commentsSynced,
            users_mapped: usersMapped,
            errors,
            completed_at: new Date().toISOString(),
          }).eq("id", logId);

          return json({
            success: true,
            log_id: logId,
            projects_synced: projectsSynced,
            sections_synced: sectionsSynced,
            tasks_synced: tasksSynced,
            subtasks_synced: subtasksSynced,
            attachments_synced: attachmentsSynced,
            comments_synced: commentsSynced,
            collaborators_synced: collaboratorsSynced,
            users_mapped: usersMapped,
            errors,
          });
        } catch (e: any) {
          await adminClient.from("asana_sync_log").update({
            status: "failed",
            errors: [...errors, { fatal: e.message }],
            completed_at: new Date().toISOString(),
          }).eq("id", logId);

          return json({ error: e.message, errors }, 500);
        }
      }

      case "/analyze-structure": {
        if (!workspace_gid) return json({ error: "workspace_gid obrigatório" }, 400);

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

        const allProjects = await asanaGetAll(`/workspaces/${workspace_gid}/projects`, asanaPat, {
          opt_fields: "name,custom_field_settings,custom_field_settings.custom_field,custom_field_settings.custom_field.name,custom_field_settings.custom_field.type,custom_field_settings.custom_field.enum_options,custom_field_settings.custom_field.enum_options.name",
        });

        const sampleProjects = allProjects.filter((p: any) => !p.archived).slice(0, 3);
        const sampleTasks: any[] = [];
        const allCustomFields = new Map<string, any>();
        const allTags = new Set<string>();
        let hasDependencies = false;
        let hasAttachments = false;
        let hasFollowers = false;

        for (const proj of sampleProjects) {
          for (const cfs of (proj.custom_field_settings || [])) {
            const cf = cfs.custom_field;
            if (cf) {
              allCustomFields.set(cf.gid, {
                gid: cf.gid, name: cf.name, type: cf.type,
                enum_options: cf.enum_options?.map((o: any) => o.name) || [],
              });
            }
          }

          const tasks = await asanaGetAll(`/projects/${proj.gid}/tasks`, asanaPat, {
            opt_fields: "name,custom_fields,custom_fields.name,custom_fields.type,custom_fields.display_value,custom_fields.enum_value,tags,tags.name,dependencies,dependents,attachments,followers,start_on,due_on,due_at,completed,parent,num_subtasks",
          });

          for (const t of tasks.slice(0, 10)) {
            sampleTasks.push(t);
            for (const cf of (t.custom_fields || [])) {
              if (!allCustomFields.has(cf.gid)) {
                allCustomFields.set(cf.gid, { gid: cf.gid, name: cf.name, type: cf.type });
              }
            }
            for (const tag of (t.tags || [])) allTags.add(tag.name);
            if (t.dependencies?.length > 0 || t.dependents?.length > 0) hasDependencies = true;
            if (t.attachments?.length > 0) hasAttachments = true;
            if (t.followers?.length > 0) hasFollowers = true;
          }
        }

        const asanaStructure = {
          total_projects: allProjects.filter((p: any) => !p.archived).length,
          sample_projects: sampleProjects.map((p: any) => p.name),
          custom_fields: Array.from(allCustomFields.values()),
          tags: Array.from(allTags),
          has_dependencies: hasDependencies,
          has_attachments: hasAttachments,
          has_followers: hasFollowers,
          sample_task_count: sampleTasks.length,
          sample_tasks: sampleTasks.slice(0, 5).map((t: any) => ({
            name: t.name,
            custom_fields: t.custom_fields?.map((cf: any) => ({ name: cf.name, type: cf.type, display_value: cf.display_value })),
            tags: t.tags?.map((tag: any) => tag.name),
            has_parent: !!t.parent,
            num_subtasks: t.num_subtasks,
          })),
        };

        const localSchema = {
          projeto_tarefas: ["id", "projeto_id", "secao_id", "titulo", "descricao", "status", "prioridade", "data_prazo", "data_inicio", "data_conclusao", "responsavel_id", "criador_id", "ordem", "estagio", "codigo", "cor_etiqueta", "parent_tarefa_id", "asana_gid", "origem_projeto"],
          projeto_secoes: ["id", "projeto_id", "nome", "cor", "ordem", "asana_gid"],
          projetos: ["id", "nome", "descricao", "cor", "status", "tipo", "asana_gid", "origem_projeto"],
          projeto_tarefa_comentarios: ["id", "tarefa_id", "user_id", "conteudo"],
        };

        const aiPrompt = `Você é um engenheiro de dados analisando uma migração do Asana para um sistema customizado.

## Estrutura encontrada no Asana:
${JSON.stringify(asanaStructure, null, 2)}

## Schema atual do sistema local:
${JSON.stringify(localSchema, null, 2)}

## Tarefa:
Analise os dados do Asana e produza um relatório detalhado em Markdown com:
1. **📊 Resumo da Estrutura Asana**
2. **🔄 Mapeamento Campo a Campo** — Tabela: Campo Asana | Campo Local | Status (✅/🆕/⏭️)
3. **🆕 Campos que Precisam Ser Criados**
4. **📋 SQL Sugerido**
5. **🖥️ Sugestões de Frontend**
6. **⚠️ Pontos de Atenção**

Seja específico com nomes de colunas, tipos e relações. Use snake_case em português.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: aiPrompt }],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) return json({ error: "Limite de requisições IA excedido" }, 429);
          if (aiResponse.status === 402) return json({ error: "Créditos insuficientes para análise IA" }, 402);
          const errText = await aiResponse.text();
          console.error("AI Gateway error:", aiResponse.status, errText);
          return json({ error: "Erro na análise IA" }, 500);
        }

        const aiData = await aiResponse.json();
        const report = aiData.choices?.[0]?.message?.content || "Relatório não gerado";
        return json({ report, structure: asanaStructure });
      }

      case "/status": {
        const { data: logs } = await adminClient
          .from("asana_sync_log")
          .select("*")
          .eq("started_by", userId)
          .order("started_at", { ascending: false })
          .limit(10);
        return json({ logs: logs || [] });
      }

      default:
        return json({ error: `Rota desconhecida: ${path}` }, 400);
    }
  } catch (e: any) {
    console.error("asana-sync error:", e);
    return json({ error: e.message }, 500);
  }
});

// --- Helpers ---

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asanaGet(path: string, pat: string, params?: Record<string, string>) {
  const url = new URL(`${ASANA_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Asana API ${res.status}: ${errBody}`);
  }
  return res.json();
}

async function asanaGetAll(path: string, pat: string, params?: Record<string, string>) {
  const all: any[] = [];
  let offset: string | null = null;
  do {
    const url = new URL(`${ASANA_API}${path}`);
    url.searchParams.set("limit", "100");
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Asana API ${res.status}: ${errBody}`);
    }
    const json = await res.json();
    all.push(...(json.data || []));
    offset = json.next_page?.offset || null;
  } while (offset);
  return all;
}

function subtypeToLocal(subtype: string): { tipo: string; campo: string | null } {
  const map: Record<string, { tipo: string; campo: string | null }> = {
    "enum_custom_field_changed": { tipo: "estagio_change", campo: "campo_customizado" },
    "section_changed": { tipo: "secao_change", campo: "secao" },
    "added_to_project": { tipo: "secao_change", campo: "projeto" },
    "assigned": { tipo: "responsavel_change", campo: "responsavel" },
    "reassigned": { tipo: "responsavel_change", campo: "responsavel" },
    "due_date_changed": { tipo: "prazo_change", campo: "data_prazo" },
    "marked_duplicate": { tipo: "sistema", campo: null },
    "marked_complete": { tipo: "status_change", campo: "status" },
    "marked_incomplete": { tipo: "status_change", campo: "status" },
    "name_changed": { tipo: "titulo_change", campo: "titulo" },
    "notes_changed": { tipo: "descricao_change", campo: "descricao" },
  };
  return map[subtype] || { tipo: "sistema", campo: null };
}

function mapAsanaColor(color: string | null): string {
  const colorMap: Record<string, string> = {
    "dark-pink": "#E91E63", "dark-green": "#4CAF50", "dark-blue": "#2196F3",
    "dark-red": "#F44336", "dark-teal": "#009688", "dark-brown": "#795548",
    "dark-orange": "#FF9800", "dark-purple": "#9C27B0", "dark-warm-gray": "#9E9E9E",
    "light-pink": "#FCE4EC", "light-green": "#E8F5E9", "light-blue": "#E3F2FD",
    "light-red": "#FFEBEE", "light-teal": "#E0F2F1", "light-orange": "#FFF3E0",
    "light-purple": "#F3E5F5", "light-warm-gray": "#F5F5F5",
  };
  return colorMap[color || ""] || "#6366f1";
}

function mapAsanaStatus(asanaStatus: string | null): string {
  if (!asanaStatus) return "pendente";
  const s = asanaStatus.toLowerCase().trim();
  const map: Record<string, string> = {
    "em andamento": "em_andamento", "in progress": "em_andamento", "aguardando terceiros": "em_andamento",
    "aprovado com fiscal": "concluida", "concluído": "concluida", "concluido": "concluida",
    "completed": "concluida", "done": "concluida",
    "cancelado": "cancelada", "cancelled": "cancelada",
    "não iniciado": "pendente", "not started": "pendente", "pendente": "pendente",
  };
  return map[s] || "pendente";
}

function mapAsanaPriority(asanaPriority: string | null): string | null {
  if (!asanaPriority) return null;
  const p = asanaPriority.toLowerCase().trim();
  const map: Record<string, string> = {
    "alto": "alta", "alta": "alta", "high": "alta",
    "médio": "media", "medio": "media", "média": "media", "media": "media", "medium": "media",
    "baixo": "baixa", "baixa": "baixa", "low": "baixa",
    "urgente": "urgente", "urgent": "urgente",
  };
  return map[p] || null;
}
