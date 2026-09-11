begin;

alter table public.portal_leads disable trigger guard_portal_leads_delete;

with removed_cards(id) as (
  values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')
), removed_crm(id) as (
  values
    ('77df340c-7c2b-42a4-a6f4-40c93fada9b6'::uuid),
    ('052ea87e-02c1-4a95-a36c-fc24a69110ab'::uuid),
    ('b7d09e85-af5d-4b7b-ba93-e9467f6eb66a'::uuid),
    ('2a29e780-d4de-416c-b6c5-b9955c28e8cf'::uuid),
    ('fbf9dc27-dec9-4643-8729-7e7b02a763cf'::uuid),
    ('7badac65-3ab6-4e4a-b349-18290bb8e42a'::uuid),
    ('aab7c56b-86f2-4713-9d67-3f48a2e96de2'::uuid),
    ('1422f525-8983-47b1-b9b8-68e1624ad809'::uuid),
    ('e714b40f-6fa1-4b3e-bb64-ed3cf8e2a2fe'::uuid)
), removed_investors(id) as (
  values
    ('dc61e779-b24c-44bc-8687-c950d673ee72'::uuid),
    ('1f078252-d538-4b3b-8a4c-d98015227f24'::uuid),
    ('0c96c304-d08d-4480-8fdd-5b13ac9a03cb'::uuid),
    ('65273181-46b2-453f-94e7-c390fed93112'::uuid),
    ('1c41f93e-ecf9-4370-b2d8-e07dc2ebc19e'::uuid),
    ('627aca8e-8702-4fd7-8b4d-55254ac03e76'::uuid),
    ('058dd2c8-386b-4886-bb5f-4b6d9fd6b512'::uuid),
    ('dc825e20-e4a7-4d35-ab47-965426cb3616'::uuid)
)
delete from public.relationship_message_sends where lead_id in (select id from removed_cards);

with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_e20_events where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_e20_occurrences where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_e20_accesses where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_queue where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_decisions where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_events where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.relationship_cadences where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.workspace_e0_actions where card_id in (select id from removed_cards);
with removed_crm(id) as (values ('77df340c-7c2b-42a4-a6f4-40c93fada9b6'::uuid),('052ea87e-02c1-4a95-a36c-fc24a69110ab'::uuid),('b7d09e85-af5d-4b7b-ba93-e9467f6eb66a'::uuid),('2a29e780-d4de-416c-b6c5-b9955c28e8cf'::uuid),('fbf9dc27-dec9-4643-8729-7e7b02a763cf'::uuid),('7badac65-3ab6-4e4a-b349-18290bb8e42a'::uuid),('aab7c56b-86f2-4713-9d67-3f48a2e96de2'::uuid),('1422f525-8983-47b1-b9b8-68e1624ad809'::uuid),('e714b40f-6fa1-4b3e-bb64-ed3cf8e2a2fe'::uuid)) delete from public.crm_cadence_tasks where lead_id in (select id from removed_crm);
with removed_crm(id) as (values ('77df340c-7c2b-42a4-a6f4-40c93fada9b6'::uuid),('052ea87e-02c1-4a95-a36c-fc24a69110ab'::uuid),('b7d09e85-af5d-4b7b-ba93-e9467f6eb66a'::uuid),('2a29e780-d4de-416c-b6c5-b9955c28e8cf'::uuid),('fbf9dc27-dec9-4643-8729-7e7b02a763cf'::uuid),('7badac65-3ab6-4e4a-b349-18290bb8e42a'::uuid),('aab7c56b-86f2-4713-9d67-3f48a2e96de2'::uuid),('1422f525-8983-47b1-b9b8-68e1624ad809'::uuid),('e714b40f-6fa1-4b3e-bb64-ed3cf8e2a2fe'::uuid)) delete from public.crm_lead_events where lead_id in (select id from removed_crm);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.lead_ownership_history where card_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.crm_messages where investor_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.crm_timeline where investor_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.investor_notes where lead_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.portal_journey_events where investor_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.portal_engagement where investor_id in (select id from removed_cards);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.portal_meetings where investor_id in (select id from removed_cards);
with removed_investors(id) as (values ('dc61e779-b24c-44bc-8687-c950d673ee72'::uuid),('1f078252-d538-4b3b-8a4c-d98015227f24'::uuid),('0c96c304-d08d-4480-8fdd-5b13ac9a03cb'::uuid),('65273181-46b2-453f-94e7-c390fed93112'::uuid),('1c41f93e-ecf9-4370-b2d8-e07dc2ebc19e'::uuid),('627aca8e-8702-4fd7-8b4d-55254ac03e76'::uuid),('058dd2c8-386b-4886-bb5f-4b6d9fd6b512'::uuid),('dc825e20-e4a7-4d35-ab47-965426cb3616'::uuid)) delete from public.relationship_engine_log where canonical_investor_id in (select id from removed_investors);
with removed_cards(id) as (values ('gs_57437'),('gs_57771'),('gs_58992'),('gs_59056'),('gs_59058'),('gs_59108'),('gs_59142'),('gs_59311'),('gs_59315')) delete from public.portal_leads where id in (select id from removed_cards);

alter table public.portal_leads enable trigger guard_portal_leads_delete;
commit;