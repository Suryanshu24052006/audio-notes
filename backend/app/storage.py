import boto3
from botocore.config import Config

from . import config

s3 = boto3.client(
    "s3",
    endpoint_url=config.S3_ENDPOINT_URL,
    region_name=config.S3_REGION,
    aws_access_key_id=config.S3_ACCESS_KEY_ID,
    aws_secret_access_key=config.S3_SECRET_ACCESS_KEY,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": config.S3_ADDRESSING_STYLE},
        # newer boto3 adds extra checksums by default, some s3-compatible stores reject them
        request_checksum_calculation="when_required",
        response_checksum_validation="when_required",
    ),
)


def upload(fileobj, key, content_type):
    s3.upload_fileobj(fileobj, config.S3_BUCKET, key, ExtraArgs={"ContentType": content_type})


def download(key, path):
    s3.download_file(config.S3_BUCKET, key, str(path))


def playback_url(key, expires_s=6 * 3600):
    # temporary link so the browser's audio player can read the file straight from the bucket
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": config.S3_BUCKET, "Key": key},
        ExpiresIn=expires_s,
    )
