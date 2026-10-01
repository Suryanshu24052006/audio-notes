import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from . import config

s3 = boto3.client(
    "s3",
    endpoint_url=config.S3_ENDPOINT_URL,
    region_name=config.S3_REGION,
    aws_access_key_id=config.S3_ACCESS_KEY_ID,
    aws_secret_access_key=config.S3_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)


def upload_url(key, content_type, expires_s=900):
    # browser has to send the same Content-Type, it's part of the signature
    return s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": config.S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires_s,
    )


def exists(key):
    try:
        s3.head_object(Bucket=config.S3_BUCKET, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def download(key, path):
    s3.download_file(config.S3_BUCKET, key, str(path))
