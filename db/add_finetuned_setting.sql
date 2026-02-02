-- Add use_finetuned_model setting

insert into ai_settings (key, value, description) values
('use_finetuned_model', 'true', 'Use fine-tuned model instead of base GPT-4o-mini')
on conflict (key) do update set value = excluded.value;
