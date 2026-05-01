// _shared/shipsgo-schema.ts — Mapa versionado: campos da API ShipsGo v2 ↔ colunas locais.
// Mantido manualmente; serve de "ground truth" para a IA auditar cobertura técnica
// sem precisar fazer introspecção em runtime.

export const SHIPSGO_API_FIELDS_OCEAN = [
  // Identificação
  { api: "id", local: "shipsgo_id", obs: "PK remoto na ShipsGo" },
  { api: "container_number", local: "container_number", obs: "" },
  { api: "bl_number", local: "bl_number", obs: "Bill of Lading" },
  { api: "booking_number", local: "booking_number", obs: "" },
  // Carrier
  { api: "carrier.code", local: "carrier_code", obs: "SCAC code" },
  { api: "carrier.name", local: "carrier_name", obs: "" },
  // Status
  { api: "status", local: "status", obs: "Normalizado uppercase" },
  // Portos
  { api: "port_of_loading.name", local: "pol_name", obs: "" },
  { api: "port_of_loading.country", local: "pol_country", obs: "" },
  { api: "port_of_loading.unlocode", local: "pol_unlocode", obs: "" },
  { api: "port_of_discharge.name", local: "pod_name", obs: "" },
  { api: "port_of_discharge.country", local: "pod_country", obs: "" },
  { api: "port_of_discharge.unlocode", local: "pod_unlocode", obs: "" },
  // Datas
  { api: "eta", local: "eta_atual", obs: "Estimated Time of Arrival" },
  { api: "eta_original", local: "eta_original", obs: "Snapshot inicial" },
  { api: "ata", local: "ata", obs: "Actual Time of Arrival" },
  { api: "departure_date", local: "data_embarque", obs: "ATD" },
  // Eventos
  { api: "events[].timestamp", local: "shipsgo_shipment_events.event_at", obs: "" },
  { api: "events[].event_type", local: "shipsgo_shipment_events.event_type", obs: "" },
  { api: "events[].event_code", local: "shipsgo_shipment_events.event_code", obs: "" },
  { api: "events[].description", local: "shipsgo_shipment_events.description", obs: "" },
  { api: "events[].location.name", local: "shipsgo_shipment_events.location_name", obs: "" },
  { api: "events[].location.unlocode", local: "shipsgo_shipment_events.location_unlocode", obs: "" },
  { api: "events[].vessel.name", local: "shipsgo_shipment_events.vessel_name", obs: "" },
  { api: "events[].voyage_number", local: "shipsgo_shipment_events.voyage_number", obs: "" },
  // Campos da API ShipsGo conhecidos mas NÃO persistidos hoje
  { api: "transhipments", local: null, obs: "Não persistido" },
  { api: "milestones", local: null, obs: "Não persistido (usamos events)" },
  { api: "co2_emissions", local: null, obs: "Não persistido" },
  { api: "container_size", local: null, obs: "Não persistido" },
  { api: "container_type", local: null, obs: "Não persistido" },
  { api: "vessel.imo", local: null, obs: "Não persistido (apenas nome via events)" },
  { api: "route.geojson", local: "geojson", obs: "Persistido via mapeamento custom" },
];

export const SHIPSGO_LOCAL_TABLES = {
  china_embarques: [
    "id", "ordem_compra_id", "numero_container", "numero_bl", "booking_number",
    "navio", "porto_origem", "porto_destino", "data_embarque", "data_eta",
    "status", "modalidade", "tipo_embarque", "numero_embarque",
  ],
  shipsgo_shipments: [
    "id", "embarque_id", "ordem_compra_id", "shipsgo_id",
    "container_number", "bl_number", "booking_number",
    "carrier_code", "carrier_name", "status",
    "pol_name", "pol_country", "pol_unlocode",
    "pod_name", "pod_country", "pod_unlocode",
    "eta_original", "eta_atual", "ata", "data_embarque", "dias_atraso",
    "last_event_at", "last_event_description", "last_event_location",
    "geojson", "raw_payload",
  ],
  shipsgo_shipment_events: [
    "id", "shipment_id", "event_type", "event_code", "description",
    "location_name", "location_unlocode", "vessel_name", "voyage_number",
    "event_at", "is_actual", "raw",
  ],
  shipsgo_webhook_log: [
    "id", "shipsgo_id", "event_type", "signature_valid", "payload",
    "processed_at", "error_message", "received_at",
  ],
};

export const SHIPSGO_WEBHOOK_EVENTS_SUPORTADOS = [
  "ocean.shipment.created",
  "ocean.shipment.updated",
  "ocean.shipment.deleted",
  "ocean.shipment.event.added",
];
