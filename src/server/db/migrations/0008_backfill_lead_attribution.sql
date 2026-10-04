/* رویدادهای ثبت لید تا امروز بدون مبدأ نوشته می‌شدند: ستون کانال و utm
   خالی می‌ماند و در گزارش‌ها همه زیر «ثبت‌نشده» می‌افتادند، پس معلوم
   نمی‌شد کدام کمپین مشتری ساخته است.

   خوشبختانه همان مبدأ روی خود ردیف لید ذخیره شده بود. این مایگریشن
   آن را به رویداد برمی‌گرداند تا تاریخچه هم قابل گزارش شود.

   `json_extract` شناسهٔ لید را از ستون props بیرون می‌کشد — همان چیزی که
   هنگام ثبت رویداد نوشته شده. ردیف‌هایی که لید متناظرشان پیدا نشود
   دست‌نخورده می‌مانند. */
UPDATE events
SET
  channel = coalesce(
    (SELECT l.channel FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    (SELECT l.first_channel FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    channel
  ),
  utm_source = coalesce(
    (SELECT l.utm_source FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    (SELECT l.first_utm_source FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    utm_source
  ),
  utm_medium = coalesce(
    (SELECT l.utm_medium FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    (SELECT l.first_utm_medium FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    utm_medium
  ),
  utm_campaign = coalesce(
    (SELECT l.utm_campaign FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    (SELECT l.first_utm_campaign FROM leads l WHERE l.id = json_extract(events.props, '$.leadId')),
    utm_campaign
  )
WHERE
  type = 'lead_submit'
  AND channel IS NULL
  AND json_extract(props, '$.leadId') IS NOT NULL;
